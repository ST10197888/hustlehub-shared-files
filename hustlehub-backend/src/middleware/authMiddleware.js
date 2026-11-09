const {
    verifyAccessToken,
    isSessionRevoked
} = require("../services/sessionSecurity");

function rejectToken(req, res, message, reason) {
    req.logEvent("warn", "auth.token.rejected", { reason });

    return res.status(401).json({
        success: false,
        message
    });
}

async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return rejectToken(
            req,
            res,
            "Authentication required. No token provided.",
            "missing_token"
        );
    }

    if (typeof authHeader !== "string") {
        return rejectToken(
            req,
            res,
            "Invalid authorization header. Expected Bearer token.",
            "invalid_header"
        );
    }

    const parts = authHeader.trim().split(/\s+/);

    if (
        parts.length !== 2 ||
        parts[0].toLowerCase() !== "bearer" ||
        !parts[1]
    ) {
        return rejectToken(
            req,
            res,
            "Invalid authorization header. Expected Bearer token.",
            "invalid_header"
        );
    }

    if (!process.env.JWT_SECRET) {
        req.logEvent("error", "auth.token.error", {
            reason: "jwt_configuration_missing"
        });

        return res.status(500).json({
            success: false,
            message: "Authentication service is unavailable."
        });
    }

    let claims;

    try {
        claims = verifyAccessToken(parts[1]);
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return rejectToken(
                req,
                res,
                "Authentication token has expired. Please log in again.",
                "token_expired"
            );
        }

        if (error.name === "NotBeforeError") {
            return rejectToken(
                req,
                res,
                "Authentication token is not active.",
                "token_not_active"
            );
        }

        return rejectToken(
            req,
            res,
            "Invalid authentication token.",
            "invalid_token"
        );
    }

    try {
        if (await isSessionRevoked(claims)) {
            return rejectToken(
                req,
                res,
                "This session has ended. Please log in again.",
                "session_revoked"
            );
        }
    } catch {
        req.logEvent("error", "auth.token.error", {
            reason: "revocation_lookup_failed"
        });

        return res.status(503).json({
            success: false,
            message: "Authentication service is temporarily unavailable."
        });
    }

    req.user = {
        userId: claims.userId,
        email: claims.email,
        role: claims.role
    };

    req.authClaims = claims;

    res.setHeader("Cache-Control", "no-store");

    return next();
}

module.exports = authenticateToken;