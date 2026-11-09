const express = require("express");
const bcrypt = require("bcryptjs");
const { issueAccessToken } = require("../services/sessionSecurity");
const { body, validationResult } = require("express-validator");

const User = require("../models/User");
const { authLimiter } = require("../middleware/rateLimiter");

const {
    getLoginCooldown,
    recordFailedLogin,
    recordSuccessfulLogin
} = require("../services/loginProtection");

const router = express.Router();

const allowedFields = ["email", "password"];

const dummyPasswordHash = bcrypt.hashSync(
    "not-a-real-account-password",
    10
);

function rejectCooldown(req, res, state, reason) {
    req.logEvent("warn", "auth.login.blocked", {
        reason,
        retryAfterSeconds: state.retryAfterSeconds
    });

    res.setHeader("Retry-After", String(state.retryAfterSeconds));

    return res.status(429).json({
        success: false,
        message: "Too many failed sign-in attempts. Please try again later.",
        retryAfterSeconds: state.retryAfterSeconds
    });
}

router.post("/login", authLimiter, [
    body().isObject().withMessage("Request body must be a JSON object.")
        .bail()
        .custom((value) =>
            Object.keys(value).every((key) => allowedFields.includes(key))
        )
        .withMessage("Request contains unsupported fields."),

    body("email").isString().withMessage("Email must be text.")
        .bail().trim().notEmpty().withMessage("Email is required.")
        .bail().isLength({ max: 254 }).withMessage("Email is too long.")
        .bail().isEmail().withMessage("Invalid email structure.")
        .normalizeEmail(),

    body("password").isString().withMessage("Password must be text.")
        .bail().notEmpty().withMessage("Password is required.")
        .bail().isLength({ max: 128 }).withMessage("Password is too long.")
], async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            req.logEvent("warn", "auth.login.failure", {
                reason: "validation_failed"
            });

            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        if (!process.env.JWT_SECRET) {
            req.logEvent("error", "auth.login.error", {
                reason: "jwt_configuration_missing"
            });

            return res.status(500).json({
                success: false,
                message: "Authentication service is unavailable."
            });
        }

        const { email, password } = req.body;

        const cooldown = await getLoginCooldown(email);

        if (cooldown.locked) {
            return rejectCooldown(
                req,
                res,
                cooldown,
                "cooldown_active"
            );
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        }).select("+password");

        // Perform a password comparison for unknown accounts as well.
        const matchedPassword = await bcrypt.compare(
            password,
            user ? user.password : dummyPasswordHash
        );

        if (!user || !matchedPassword) {
            const failed = await recordFailedLogin(email);

            req.logEvent("warn", "auth.login.failure", {
                reason: "invalid_credentials"
            });

            if (failed.locked) {
                return rejectCooldown(
                    req,
                    res,
                    failed,
                    "cooldown_started"
                );
            }

            return res.status(401).json({
                success: false,
                message: "Incorrect email or password."
            });
        }

        // Concurrent failures may have started a cooldown.
        const successful = await recordSuccessfulLogin(email);

        if (successful.locked) {
            return rejectCooldown(
                req,
                res,
                successful,
                "cooldown_active"
            );
        }

               const token = issueAccessToken(user);

        req.logEvent("info", "auth.login.success", {
            actorId: user._id.toString()
        });

        return res.status(200).json({
            success: true,
            message: "Signed in successfully.",
            token,
            user: {
                id: user._id.toString(),
                name: user.name,
                surname: user.surname,
                email: user.email,
                role: user.role
            }
        });
    } catch {
        req.logEvent("error", "auth.login.error", {
            reason: "authentication_failed"
        });

        return res.status(500).json({
            success: false,
            message: "Internal server error occurred."
        });
    }
});

module.exports = router;