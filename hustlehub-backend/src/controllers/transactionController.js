const Transaction = require("../models/Transaction");
const { parseMongoId } = require("../utils/mongoId");

const newestFirst = { createdAt: -1 };

async function getMyTransactions(req, res) {
    try {

        const clientId = parseMongoId(req.user?.userId);

        if (!clientId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication."
            });
        }

        const filter = { clientId };


        const transactions = await Transaction.find(filter)
            .sort(newestFirst)
            .lean();

        req.logEvent("info", "transaction.list.viewed");

        return res.status(200).json({
            success: true,
            count: transactions.length,
            transactions
        });
    } catch {
        req.logEvent("error", "transaction.list.failed", {
            reason: "lookup_failed"
        });

        return res.status(500).json({
            success: false,
            message: "Unable to load transactions."
        });
    }
}

async function getFreelancerIncome(req, res) {
    try {

        const freelancerId = parseMongoId(req.user?.userId);

        if (!freelancerId) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication."
            });
        }


        const filter = {
            freelancerId,
            status: "completed"
        };

        const [summary] = await Transaction.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: null,
                    totalIncome: { $sum: "$amount" },
                    completedBookings: { $sum: 1 }
                }
            }
        ]);

        const recentTransactions = await Transaction.find(filter)
            .sort(newestFirst)
            .limit(20)
            .lean();

        const total = summary ? summary.totalIncome : 0;

        req.logEvent("info", "transaction.income.viewed");

        return res.status(200).json({
            success: true,
            income: {
                currency: "ZAR",
                totalIncome: Math.round(total * 100) / 100,
                completedBookings: summary
                    ? summary.completedBookings
                    : 0
            },
            recentTransactions
        });
    } catch {
        req.logEvent("error", "transaction.income.failed", {
            reason: "calculation_failed"
        });

        return res.status(500).json({
            success: false,
            message: "Unable to calculate income."
        });
    }
}

module.exports = {
    getMyTransactions,
    getFreelancerIncome
};