
const ALLOWED_ROLES = ["client", "freelancer"];

/**
 * Restricts access to users with specified roles.
 * Use authenticateToken before this middleware.
 *
 * Example:
 * router.get("/freelancer", authenticateToken, requireRole("freelancer"), handler);
 */
function requireRole(...allowedRoles) {
    if (
        allowedRoles.length === 0 ||
        allowedRoles.some((role) => !ALLOWED_ROLES.includes(role))
    ) {
        throw new Error("Invalid or missing role configuration.");
    }

    return function (req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to access this resource."
            });
        }

        return next();
    };
}

module.exports = requireRole;
