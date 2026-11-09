const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");
const { getFinancialSummary } = require("../controllers/financialController");

const router = express.Router();

router.get(
    "/summary",
    authenticateToken,
    requireRole("freelancer"),
    getFinancialSummary
);

module.exports = router;
