const rateLimit = require("express-rate-limit");

const windowMs = 15 * 60 * 1000;

const createLimiter = (limit, message) => rateLimit({
    windowMs,
    limit,
    handler: (req, res) => {
        const loginAttempt = req.method === "POST" &&
            ["/login", "/api/auth/login"].includes(req.path);

        try {
            req.logEvent?.(
                "warn",
                loginAttempt
                    ? "auth.login.blocked"
                    : "security.rate_limit.denied",
                {
                    reason: "request_rate_limit",
                    statusCode: 429
                }
            );
        } catch {
            // Logging failures must not interrupt rate-limit enforcement.
        }

        return res.status(429).json({
            success: false,
            message
        });
    }
});

const authLimit = process.env.AUTH_RATE_LIMIT
    ? Number(process.env.AUTH_RATE_LIMIT)
    : 10;

if (!Number.isInteger(authLimit) || authLimit < 1) {
    throw new Error("AUTH_RATE_LIMIT must be a positive integer.");
}

const authLimiter = createLimiter(
    authLimit,
    "Too many authentication requests have been made. Please try again in 15 minutes."
);

const bookingLimiter = createLimiter(
    20,
    "Too many booking requests have been made. Please try again in 15 minutes."
);

const generalLimiter = createLimiter(
    100,
    "Too many requests have been made. Please try again in 15 minutes."
);

module.exports = {
    authLimiter,
    bookingLimiter,
    generalLimiter
};