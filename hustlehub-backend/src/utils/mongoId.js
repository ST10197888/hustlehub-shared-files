
const mongoose = require("mongoose");

function parseMongoId(value) {
    if (
        typeof value !== "string" ||
        !/^[a-fA-F0-9]{24}$/.test(value)
    ) {
        return null;
    }

    return new mongoose.Types.ObjectId(value);
}

module.exports = { parseMongoId };
