const express = require("express");
const request = require("supertest");

jest.mock("../src/config/logger", () => ({
    logEvent: jest.fn()
}));

const { logEvent } = require("../src/config/logger");
const requestLogger = require("../src/middleware/requestLogger");
const errorHandler = require("../src/middleware/errorHandler");

const ACTOR_ID = "64b000000000000000000001";

function makeApp() {
    const app = express();

    app.use(requestLogger);
    app.use(express.json({ limit: "1kb" }));

    const router = express.Router();

    router.get("/items/:id", (req, res) => {
        res.json({ success: true });
    });

    app.use("/api/example", router);

    app.get("/blocked", (req, res) => res.sendStatus(403));
    app.get("/failure", (req, res) => res.sendStatus(500));

    app.get("/throw", () => {
        throw new Error("SECRET_DATABASE_CONNECTION");
    });

    app.get("/cors-error", () => {
        const error = new Error("SECRET_INTERNAL_DETAILS");
        error.name = "CorsOriginError";
        throw error;
    });

    app.get("/actor", (req, res) => {
        req.user = { userId: ACTOR_ID };

        req.logEvent("info", "booking.created", {
            bookingId: "booking-123",
            requestId: "forged-id",
            actorId: "forged-actor",
            method: "forged-method",
            route: "forged-route"
        });

        res.json({ success: true });
    });

    app.use((req, res) => res.sendStatus(404));
    app.use(errorHandler);

    return app;
}

beforeEach(() => {
    logEvent.mockReset();
});

describe("Request logging middleware", () => {
    test("generates a server request ID and returns it in the header", async () => {
        const res = await request(makeApp())
            .get("/api/example/items/123")
            .set("X-Request-ID", "caller-controlled-id");

        expect(res.status).toBe(200);

        expect(res.headers["x-request-id"])
            .toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);

        expect(logEvent).toHaveBeenCalledWith(
            "info",
            "http.request.completed",
            expect.objectContaining({
                requestId: res.headers["x-request-id"],
                statusCode: 200,
                durationMs: expect.any(Number)
            })
        );
    });

    test("assigns different IDs to separate requests", async () => {
        const app = makeApp();

        const first = await request(app).get("/api/example/items/1");
        const second = await request(app).get("/api/example/items/2");

        expect(first.headers["x-request-id"])
            .not.toBe(second.headers["x-request-id"]);
    });

    test("uses route templates and excludes raw paths, queries and headers", async () => {
        const app = makeApp();

        await request(app)
            .get("/api/example/items/PRIVATE_ID?token=PRIVATE_QUERY")
            .set("Authorization", "Bearer PRIVATE_TOKEN");

        expect(logEvent).toHaveBeenCalledWith(
            "info",
            "http.request.completed",
            expect.objectContaining({
                route: "/api/example/items/:id"
            })
        );

        await request(app).get("/PRIVATE_PATH?secret=PRIVATE_QUERY");

        expect(logEvent).toHaveBeenLastCalledWith(
            "warn",
            "http.request.completed",
            expect.objectContaining({
                route: "unmatched",
                statusCode: 404
            })
        );

        expect(JSON.stringify(logEvent.mock.calls))
            .not.toMatch(/PRIVATE_/);
    });

    test("uses warning severity for rejected requests", async () => {
        await request(makeApp()).get("/blocked");

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "http.request.completed",
            expect.objectContaining({ statusCode: 403 })
        );
    });

    test("uses error severity for server failures", async () => {
        await request(makeApp()).get("/failure");

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "http.request.completed",
            expect.objectContaining({ statusCode: 500 })
        );
    });

    test("correlates business events with the authenticated actor and request", async () => {
        const res = await request(makeApp()).get("/actor");

        expect(logEvent).toHaveBeenCalledWith(
            "info",
            "booking.created",
            expect.objectContaining({
                actorId: ACTOR_ID,
                bookingId: "booking-123",
                requestId: res.headers["x-request-id"],
                method: "GET",
                route: "/actor"
            })
        );
    });

    test("does not allow event details to replace trusted request context", async () => {
        await request(makeApp()).get("/actor");

        expect(JSON.stringify(logEvent.mock.calls))
            .not.toMatch(/forged-/);
    });

    test("preserves the API response when the logging function throws", async () => {
        logEvent.mockImplementation(() => {
            throw new Error("Logging destination unavailable");
        });

        const res = await request(makeApp()).get("/actor");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true });
    });

    test("logs internal failures without exposing the raw error", async () => {
        const res = await request(makeApp()).get("/throw");

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "http.request.error",
            expect.objectContaining({
                reason: "internal_error",
                requestId: res.headers["x-request-id"]
            })
        );

        expect(JSON.stringify([res.body, logEvent.mock.calls]))
            .not.toContain("SECRET_DATABASE_CONNECTION");
    });

    test("records malformed JSON as a safe 400 response", async () => {
        const res = await request(makeApp())
            .post("/anything")
            .set("Content-Type", "application/json")
            .send('{"password":"SECRET_PASSWORD",');

        expect(res.status).toBe(400);

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "http.request.error",
            expect.objectContaining({
                reason: "invalid_json",
                statusCode: 400
            })
        );

        expect(JSON.stringify([res.body, logEvent.mock.calls]))
            .not.toContain("SECRET_PASSWORD");
    });

    test("records oversized bodies as a safe 413 response", async () => {
        const res = await request(makeApp())
            .post("/anything")
            .send({ text: "x".repeat(2000) });

        expect(res.status).toBe(413);

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "http.request.error",
            expect.objectContaining({
                reason: "body_too_large",
                statusCode: 413
            })
        );
    });

    test("records CORS rejection without exposing error details", async () => {
        const res = await request(makeApp()).get("/cors-error");

        expect(res.status).toBe(403);

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "http.request.error",
            expect.objectContaining({
                reason: "cors_origin_denied",
                statusCode: 403
            })
        );

        expect(JSON.stringify([res.body, logEvent.mock.calls]))
            .not.toContain("SECRET_INTERNAL_DETAILS");
    });
});