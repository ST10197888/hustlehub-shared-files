const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");
const {
    bookingRules,
    validateBooking
} = require("../middleware/bookingValidation");
const {
    createBooking,
    getMyBookings,
    getFreelancerBookings
} = require("../controllers/bookingController");
const { bookingLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post(
    "/",
    bookingLimiter,
    authenticateToken,
    requireRole("client"),
    bookingRules,
    validateBooking,
    createBooking
);

router.get("/my", authenticateToken, requireRole("client"), getMyBookings);

router.get(
    "/freelancer",
    authenticateToken,
    requireRole("freelancer"),
    getFreelancerBookings
);

module.exports = router;
