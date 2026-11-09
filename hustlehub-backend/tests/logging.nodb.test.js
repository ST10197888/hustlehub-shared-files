const { PassThrough } = require("node:stream");
const winston = require("winston");
const { createEventLogger } = require("../src/config/logger");

describe("Structured event logger", () => {
    let logger;
    let stream;
    let transport;
    let records;

    beforeEach(() => {
        records = [];

        stream = new PassThrough();

        stream.on("data", (chunk) => {
            records.push(JSON.parse(chunk.toString()));
        });

        transport = new winston.transports.Stream({ stream });

        logger = createEventLogger({
            transports: [transport]
        });
    });

    afterEach(() => {
        logger.close();
        stream.destroy();
        jest.restoreAllMocks();
    });

    test("writes structured events with timestamps and severity", () => {
        expect(logger.logEvent("info", "auth.login.success", {
            requestId: "request-123",
            actorId: "64b000000000000000000001"
        })).toBe(true);

        expect(records).toHaveLength(1);

        expect(records[0]).toMatchObject({
            level: "info",
            service: "hustlehub-backend",
            event: "auth.login.success",
            message: "auth.login.success",
            requestId: "request-123",
            actorId: "64b000000000000000000001"
        });

        expect(new Date(records[0].timestamp).toISOString())
            .toBe(records[0].timestamp);
    });

    test("excludes credentials, personal data and raw payloads", () => {
        logger.logEvent("warn", "auth.login.failure", {
            reason: "invalid_credentials",
            password: "SECRET_PASSWORD",
            token: "SECRET_TOKEN",
            email: "PRIVATE_EMAIL",
            headers: { authorization: "SECRET_HEADER" },
            body: { password: "SECRET_BODY" },
            error: new Error("SECRET_ERROR")
        });

        const output = JSON.stringify(records);

        expect(records[0].reason).toBe("invalid_credentials");
        expect(output).not.toMatch(/SECRET_|PRIVATE_EMAIL/);
    });

    test("prevents metadata from overwriting authoritative fields", () => {
        logger.logEvent("info", "booking.created", {
            level: "error",
            event: "forged.event",
            message: "forged message",
            service: "forged-service",
            timestamp: "forged-time"
        });

        expect(records[0]).toMatchObject({
            level: "info",
            event: "booking.created",
            message: "booking.created",
            service: "hustlehub-backend"
        });

        expect(records[0].timestamp).not.toBe("forged-time");
    });

    test("rejects invalid event names and unsafe metadata types", () => {
        expect(logger.logEvent("debug", "auth.login.success"))
            .toBe(false);

        expect(logger.logEvent("info", "event\nforged"))
            .toBe(false);

        expect(records).toHaveLength(0);

        logger.logEvent("info", "http.request.completed", {
            actorId: { password: "SECRET_OBJECT" },
            durationMs: Infinity,
            statusCode: 200
        });

        expect(records[0].statusCode).toBe(200);
        expect(records[0].actorId).toBeUndefined();
        expect(records[0].durationMs).toBeUndefined();
    });

    test("handles transport errors without throwing or exposing secrets", () => {
        const fallback = jest.spyOn(process.stderr, "write")
            .mockReturnValue(true);

        expect(() => {
            transport.emit("error", new Error("SECRET_TOKEN"));
        }).not.toThrow();

        expect(fallback).toHaveBeenCalled();

        expect(JSON.stringify(fallback.mock.calls))
            .not.toContain("SECRET_TOKEN");

        expect(logger.logEvent("info", "booking.created"))
            .toBe(true);
    });
});