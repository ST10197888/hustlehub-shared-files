const crypto = require("crypto");
const Booking = require("../models/Booking");
const Transaction = require("../models/Transaction");
const Gig = require("../models/Gig");
const { parseMongoId } = require("../utils/mongoId");


const newestFirst = { createdAt: -1 };

function generateTransactionId() {
    return "TXN-" + crypto.randomBytes(6).toString("hex").toUpperCase();
}

async function createBooking(req, res) {
    let booking;
    let transactionRecorded = false;
    let stage = "gig_lookup";

    try {

const { gigId, notes } = req.body;

const validGigId = parseMongoId(gigId);
const validClientId = parseMongoId(req.user?.userId);

if (!validClientId) {
    return res.status(401).json({
        success: false,
        message: "Invalid authentication."
    });
}

if (!validGigId) {
    return res.status(400).json({
        success: false,
        message: "Invalid gig ID."
    });
}

if (
    notes !== undefined &&
    (typeof notes !== "string" || notes.length > 2000)
) {
    return res.status(400).json({
        success: false,
        message: "Invalid booking notes."
    });
}

const fields = "title price freelancer";
const gig = await Gig.findById(validGigId)
    .select(fields)
    .lean();


        if (!gig) {
            req.logEvent("warn", "booking.rejected", {
                reason: "gig_not_found"
            });

            return res.status(404).json({
                success: false,
                message: "Gig not found."
            });
        }

        stage = "booking_creation";

        // Price and freelancer come from the database, never the request.
        booking = await Booking.create({
            gigId: gig._id,
            clientId: validClientId,
            freelancerId: gig.freelancer,
            gigTitle: gig.title,
            price: gig.price,
            notes: notes || ""
        });

        stage = "transaction_recording";

        const transaction = await Transaction.create({
            transactionId: generateTransactionId(),
            bookingId: booking._id,
            clientId: validClientId,
            freelancerId: gig.freelancer,
            gigId: gig._id,
            amount: gig.price,
            status: "completed"
        });

        transactionRecorded = true;
        stage = "response";

        req.logEvent("info", "transaction.recorded", {
            bookingId: booking._id.toString(),
            transactionId: transaction.transactionId,
            outcome: "completed"
        });

        req.logEvent("info", "booking.created", {
            bookingId: booking._id.toString(),
            transactionId: transaction.transactionId
        });

        return res.status(201).json({
            success: true,
            message: "Booking confirmed. Payment is simulated.",
            confirmation: {
                bookingId: booking._id,
                transactionId: transaction.transactionId,
                gigTitle: booking.gigTitle,
                amount: transaction.amount,
                bookingStatus: booking.status,
                paymentStatus: transaction.status,
                bookedAt: booking.createdAt
            }
        });
    } catch {
        if (stage === "transaction_recording") {
            req.logEvent("error", "transaction.recording.failed", {
                bookingId: booking._id.toString(),
                reason: "recording_failed"
            });
        }

        // Clean up only if the transaction was not recorded.
        if (booking && !transactionRecorded) {
            try {
                await Booking.deleteOne({ _id: booking._id });

                req.logEvent("warn", "booking.cleanup.completed", {
                    bookingId: booking._id.toString(),
                    reason: "transaction_not_recorded"
                });
            } catch {
                req.logEvent("error", "booking.cleanup.failed", {
                    bookingId: booking._id.toString(),
                    reason: "cleanup_failed"
                });
            }
        }

        req.logEvent("error", "booking.create.failed", {
            reason: `${stage}_failed`
        });

        return res.status(500).json({
            success: false,
            message: "Unable to create booking. Try again later."
        });
    }
}

function listBookingsFor(ownerField, otherField) {
    return async function (req, res) {
        try {

                const validUserId = parseMongoId(req.user?.userId);

                if (!validUserId) {
                    return res.status(401).json({
                        success: false,
                        message: "Invalid authentication."
                    });
                }

                const filter = { [ownerField]: validUserId };


            const bookings = await Booking.find(filter)
                .populate(otherField, "name surname")
                .sort(newestFirst)
                .lean();

            req.logEvent("info", "booking.list.viewed");

            return res.status(200).json({
                success: true,
                count: bookings.length,
                bookings
            });
        } catch {
            req.logEvent("error", "booking.list.failed", {
                reason: "lookup_failed"
            });

            return res.status(500).json({
                success: false,
                message: "Unable to load bookings."
            });
        }
    };
}

const getMyBookings = listBookingsFor("clientId", "freelancerId");
const getFreelancerBookings = listBookingsFor("freelancerId", "clientId");

module.exports = {
    createBooking,
    getMyBookings,
    getFreelancerBookings
};