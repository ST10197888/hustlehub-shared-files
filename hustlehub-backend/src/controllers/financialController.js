const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Booking = require("../models/Booking");

const {
    SUPPORTED_TAX_YEARS,
    buildFinancialSummary
} = require("../services/financialService");

async function getFinancialSummary(req, res) {
    try {
        let taxYear;

        if (req.query.taxYear !== undefined) {
            const raw = String(req.query.taxYear);

            taxYear = /^\d{4}$/.test(raw)
                ? Number(raw)
                : Number.NaN;

            if (!SUPPORTED_TAX_YEARS.includes(taxYear)) {
                req.logEvent("warn", "financial.summary.rejected", {
                    reason: "unsupported_tax_year"
                });

                return res.status(400).json({
                    success: false,
                    message:
                        `taxYear must be one of: ${SUPPORTED_TAX_YEARS.join(", ")}.`
                });
            }
        }

        const freelancerId = new mongoose.Types.ObjectId(
            req.user.userId
        );

        const transactions = await Transaction.find({
            freelancerId
        })
            .select(
                "transactionId bookingId freelancerId amount status createdAt"
            )
            .lean();

        const bookingIds = [
            ...new Set(
                transactions.map((item) => String(item.bookingId))
            )
        ];

        const bookings = bookingIds.length
            ? await Booking.find({
                _id: { $in: bookingIds },
                freelancerId
            })
                .select("freelancerId status gigTitle")
                .lean()
            : [];

        const summary = buildFinancialSummary({
            transactions,
            bookings,
            freelancerId: req.user.userId,
            taxYear
        });

        req.logEvent("info", "financial.summary.viewed");

        return res.status(200).json({
            success: true,
            summary
        });
    } catch {
        req.logEvent("error", "financial.summary.failed", {
            reason: "calculation_failed"
        });

        return res.status(500).json({
            success: false,
            message: "Unable to calculate your financial summary."
        });
    }
}

module.exports = { getFinancialSummary };