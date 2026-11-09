const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");
const {
    getMyTransactions,
    getFreelancerIncome
} = require("../controllers/transactionController");

const router = express.Router();

router.get("/my", authenticateToken, requireRole("client"), getMyTransactions);

router.get(
    "/income",
    authenticateToken,
    requireRole("freelancer"),
    getFreelancerIncome
);

module.exports = router;
