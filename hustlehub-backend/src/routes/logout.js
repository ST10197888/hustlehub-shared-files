const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const { revokeSession } = require("../services/sessionSecurity");

const router = express.Router();

router.post("/logout", authenticateToken, async (req, res) => {
    try {
        // Revoke only the verified current session.
        await revokeSession(req.authClaims);

        req.logEvent("info", "auth.logout.success");

        return res.status(200).json({
            success: true,
            message: "Signed out successfully."
        });
    } catch {
        req.logEvent("error", "auth.logout.error", {
            reason: "revocation_failed"
        });

        return res.status(503).json({
            success: false,
            message: "Unable to sign out securely. Please try again."
        });
    }
});

module.exports = router;