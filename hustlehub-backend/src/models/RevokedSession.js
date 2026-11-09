const mongoose = require("mongoose");

const revokedSessionSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    revokedAt: {
        type: Date,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    versionKey: false
});

revokedSessionSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
    "RevokedSession",
    revokedSessionSchema
);