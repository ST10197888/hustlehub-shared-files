const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    failedAttempts: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    lockedUntil: {
        type: Date,
        default: null
    },
    resetAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, {
    versionKey: false
});

loginAttemptSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = mongoose.model("LoginAttempt", loginAttemptSchema);