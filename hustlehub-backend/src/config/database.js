const mongoose = require("mongoose");
const { logEvent } = require("./logger");

async function connectDatabase() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        logEvent("error", "database.connection.failed", {
            reason: "configuration_missing"
        });

        throw new Error("MONGODB_URI is not configured.");
    }

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000
        });
    } catch {
        logEvent("error", "database.connection.failed", {
            reason: "connection_failed"
        });

        throw new Error("Database connection failed.");
    }

    logEvent("info", "database.connected");
}

module.exports = connectDatabase;