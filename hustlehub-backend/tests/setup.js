require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");

const usesDatabase = !/\.nodb\.test\.js$/.test(
    expect.getState().testPath || ""
);

beforeAll(async () => {
    if (!usesDatabase) return;

    const testUri = process.env.MONGODB_TEST_URI;

    if (!testUri) {
        throw new Error(
            "MONGODB_TEST_URI must be configured before running tests."
        );
    }

    const databaseName = new URL(testUri).pathname.replace("/", "");

    if (
        !databaseName ||
        databaseName === "admin" ||
        databaseName === "local"
    ) {
        throw new Error(
            "MONGODB_TEST_URI must specify a dedicated test database."
        );
    }

    if (!databaseName.toLowerCase().includes("test")) {
        throw new Error(
            "The test database name must contain 'test'."
        );
    }

    await mongoose.connect(testUri, {
        serverSelectionTimeoutMS: 10000,
        runtimeAdapters: {
            os: require("node:os")
        }
    });
}, 15000);

afterEach(async () => {
    if (usesDatabase && mongoose.connection.readyState === 1) {
        const User = require("../src/models/User");
        const LoginAttempt = require("../src/models/LoginAttempt");
        const RevokedSession = require("../src/models/RevokedSession");

        await User.deleteMany({});
        await LoginAttempt.deleteMany({});
        await RevokedSession.deleteMany({});
    }
});

afterAll(async () => {
    if (!usesDatabase) return;

    await mongoose.disconnect();
});