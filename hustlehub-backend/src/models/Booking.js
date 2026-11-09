const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        gigId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Gig",
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
        gigTitle: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        notes: {
            type: String,
            maxlength: 500,
            default: ""
        },
        status: {
            type: String,
            enum: ["confirmed", "cancelled"],
            default: "confirmed"
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model("Booking", bookingSchema);
