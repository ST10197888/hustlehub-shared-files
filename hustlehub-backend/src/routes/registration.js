const express = require("express");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");

const User = require("../models/User");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

const allowedFields = [
    "name",
    "surname",
    "email",
    "password",
    "role"
];

router.post("/register", authLimiter, [
    body().isObject().withMessage("Request body must be a JSON object.")
        .bail()
        .custom((value) =>
            Object.keys(value).every((key) => allowedFields.includes(key))
        )
        .withMessage("Request contains unsupported fields."),

    body("name").isString().withMessage("Name must be text.")
        .bail().trim().notEmpty().withMessage("Name is required.")
        .bail().isLength({ max: 100 }).withMessage("Name is too long.")
        .bail().escape(),

    body("surname").isString().withMessage("Surname must be text.")
        .bail().trim().notEmpty().withMessage("Surname is required.")
        .bail().isLength({ max: 100 }).withMessage("Surname is too long.")
        .bail().escape(),

    body("email").isString().withMessage("Email must be text.")
        .bail().trim().notEmpty().withMessage("Email is required.")
        .bail().isLength({ max: 254 }).withMessage("Email is too long.")
        .bail().isEmail().withMessage("Email format incorrect.")
        .normalizeEmail(),

    body("role").isString().withMessage("Role must be text.")
        .bail().trim().notEmpty().withMessage("Role is required.")
        .bail().escape()
        .isIn(["client", "freelancer"])
        .withMessage("Role must be client or freelancer."),

    body("password").isString().withMessage("Password must be text.")
        .bail().notEmpty().withMessage("Password is required.")
        .bail().isLength({ min: 8, max: 128 })
        .withMessage("Password must contain between 8 and 128 characters.")
        .matches(/[A-Z]/)
        .withMessage("Password must contain at least one uppercase letter.")
        .matches(/[0-9]/)
        .withMessage("Password must contain at least one digit.")
        .matches(/[^A-Za-z0-9]/)
        .withMessage("Password must contain at least one special character.")
], async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            req.logEvent("warn", "auth.registration.failure", {
                reason: "validation_failed"
            });

            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, surname, email, password, role } = req.body;
        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            req.logEvent("warn", "auth.registration.failure", {
                reason: "email_exists"
            });

            return res.status(409).json({
                success: false,
                message: "Email address already exists. Try a different one."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            surname,
            email: normalizedEmail,
            password: hashedPassword,
            role
        });

        req.logEvent("info", "auth.registration.success", {
            actorId: newUser._id.toString()
        });

        return res.status(201).json({
            success: true,
            message: "User added successfully.",
            user: {
                id: newUser._id.toString(),
                name: newUser.name,
                surname: newUser.surname,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        if (error.code === 11000) {
            req.logEvent("warn", "auth.registration.failure", {
                reason: "email_exists"
            });

            return res.status(409).json({
                success: false,
                message: "Email address already exists. Try a different one."
            });
        }

        if (error.name === "ValidationError") {
            req.logEvent("warn", "auth.registration.failure", {
                reason: "model_validation_failed"
            });

            return res.status(400).json({
                success: false,
                message: "Registration details are invalid."
            });
        }

        req.logEvent("error", "auth.registration.error", {
            reason: "registration_failed"
        });

        return res.status(500).json({
            success: false,
            message: "Internal server error occurred."
        });
    }
});

module.exports = router;