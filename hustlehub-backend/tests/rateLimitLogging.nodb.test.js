const express = require("express");
const request = require("supertest");

jest.mock("../src/config/logger", () => ({
    logEvent: jest.fn()
}));

const { logEvent } = require("../src/config/logger");
const requestLogger = require("../src/middleware/requestLogger");
const { authLimiter } = require("../src/middleware/rateLimiter");

test("records login requests denied before the login handler runs", async () => {
    const app = express();

    const handler = jest.fn((req, res) => {
        res.json({ success: true });
    });

    app.use(requestLogger);
    app.use(express.json());
    app.post("/api/auth/login", authLimiter, handler);

    for (let index = 0; index < 10; index += 1) {
        const response = await request(app)
            .post("/api/auth/login")
            .send({ password: "PRIVATE_PASSWORD" });

        expect(response.status).toBe(200);
    }

    const response = await request(app)
        .post("/api/auth/login")
        .send({ password: "PRIVATE_PASSWORD" });

    expect(response.status).toBe(429);
    expect(handler).toHaveBeenCalledTimes(10);

    expect(logEvent).toHaveBeenCalledWith(
        "warn",
        "auth.login.blocked",
        expect.objectContaining({
            reason: "request_rate_limit",
            statusCode: 429,
            requestId: response.headers["x-request-id"]
        })
    );

    expect(
        JSON.stringify(logEvent.mock.calls)
    ).not.toContain("PRIVATE_PASSWORD");
});