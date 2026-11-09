
const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

/**
 * Accessible to any authenticated user.
 */
router.get("/profile", authenticateToken, (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Protected route accessed successfully.",
        user: {
            userId: req.user.userId,
            email: req.user.email,
            role: req.user.role
        }
    });
});

/**
 * Accessible only to clients.
 */
router.get(
    "/client-area",
    authenticateToken,
    requireRole("client"),
    (req, res) => {
        return res.status(200).json({
            success: true,
            message: "Client area accessed successfully."
        });
    }
);

/**
 * Accessible only to freelancers.
 */
router.get(
    "/freelancer-area",
    authenticateToken,
    requireRole("freelancer"),
    (req, res) => {
        return res.status(200).json({
            success: true,
            message: "Freelancer area accessed successfully."
        });
    }
);

module.exports = router;
