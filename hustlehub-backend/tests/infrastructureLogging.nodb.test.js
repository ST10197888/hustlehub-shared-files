const { EventEmitter } = require("node:events");

jest.mock("mongoose", () => ({
    connect: jest.fn(),
    disconnect: jest.fn()
}));

jest.mock("http", () => ({
    createServer: jest.fn()
}));

jest.mock("https", () => ({
    createServer: jest.fn()
}));

jest.mock("dns", () => ({
    setServers: jest.fn()
}));

jest.mock("fs", () => ({
    readFileSync: jest.fn()
}));

jest.mock("../src/app", () => jest.fn());
jest.mock("../src/config/database", () => jest.fn());

jest.mock("../src/config/logger", () => ({
    logEvent: jest.fn()
}));

const mongoose = require("mongoose");
const http = require("http");
const https = require("https");

const connectDatabase = require("../src/config/database");

const realConnectDatabase = jest.requireActual(
    "../src/config/database"
);

const { logEvent } = require("../src/config/logger");
const { startServer } = require("../src/server");

const keys = [
    "MONGODB_URI",
    "HTTPS_ENABLED",
    "SSL_PFX_PATH",
    "SSL_PFX_PASSPHRASE"
];

const saved = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
);

const savedExitCode = process.exitCode;

let server;

beforeEach(() => {
    jest.resetAllMocks();

    process.env.MONGODB_URI =
        "mongodb://PRIVATE_DATABASE/example";

    process.env.HTTPS_ENABLED = "false";

    delete process.env.SSL_PFX_PATH;
    delete process.env.SSL_PFX_PASSPHRASE;

    mongoose.connect.mockResolvedValue(undefined);
    mongoose.disconnect.mockResolvedValue(undefined);
    connectDatabase.mockResolvedValue(undefined);

    server = new EventEmitter();

    server.listen = jest.fn((port, ready) => {
        ready();
        return server;
    });

    http.createServer.mockReturnValue(server);
    https.createServer.mockReturnValue(server);
});

afterEach(() => {
    for (const key of keys) {
        if (saved[key] === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = saved[key];
        }
    }

    process.exitCode = savedExitCode;

    expect(
        JSON.stringify(logEvent.mock.calls)
    ).not.toMatch(/PRIVATE_/);
});

describe("Database and startup logging", () => {
    test("records successful database connection without its URI", async () => {
        await realConnectDatabase();

        expect(mongoose.connect).toHaveBeenCalledWith(
            process.env.MONGODB_URI,
            { serverSelectionTimeoutMS: 10000 }
        );

        expect(logEvent).toHaveBeenCalledWith(
            "info",
            "database.connected"
        );
    });

    test("records missing database configuration", async () => {
        delete process.env.MONGODB_URI;

        await expect(
            realConnectDatabase()
        ).rejects.toThrow("not configured");

        expect(mongoose.connect).not.toHaveBeenCalled();

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "database.connection.failed",
            { reason: "configuration_missing" }
        );
    });

    test("replaces database exceptions with a safe error", async () => {
        mongoose.connect.mockRejectedValue(
            new Error("PRIVATE_DATABASE")
        );

        await expect(
            realConnectDatabase()
        ).rejects.toThrow("Database connection failed.");

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "database.connection.failed",
            { reason: "connection_failed" }
        );
    });

    test("starts HTTP only after connecting the database", async () => {
        expect(await startServer()).toBe(server);

        expect(
            connectDatabase.mock.invocationCallOrder[0]
        ).toBeLessThan(
            server.listen.mock.invocationCallOrder[0]
        );

        expect(logEvent).toHaveBeenCalledWith(
            "info",
            "server.started",
            { outcome: "http" }
        );
    });

    test("stops startup safely when HTTPS configuration is missing", async () => {
        process.env.HTTPS_ENABLED = "true";

        expect(await startServer()).toBeNull();
        expect(server.listen).not.toHaveBeenCalled();
        expect(mongoose.disconnect).toHaveBeenCalled();

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "server.start.failed",
            { reason: "https_configuration_failed" }
        );
    });

    test("records listener failures and disconnects without raw error details", async () => {
        await startServer();

        server.emit(
            "error",
            new Error("PRIVATE_LISTENER_DETAILS")
        );

        expect(mongoose.disconnect).toHaveBeenCalled();

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "server.error",
            { reason: "listen_failed" }
        );
    });

    test("does not listen when database startup fails", async () => {
        connectDatabase.mockRejectedValue(
            new Error("PRIVATE_DATABASE")
        );

        expect(await startServer()).toBeNull();
        expect(server.listen).not.toHaveBeenCalled();

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "server.start.failed",
            { reason: "database_failed" }
        );
    });
});