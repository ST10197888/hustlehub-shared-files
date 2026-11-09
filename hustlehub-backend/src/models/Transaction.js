const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        transactionId: {
            type: String,
            required: true,
            unique: true
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            index: true
        },
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        freelancerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        gigId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Gig",
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: ["pending", "completed", "failed"],
            default: "completed"
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model("Transaction", transactionSchema);
