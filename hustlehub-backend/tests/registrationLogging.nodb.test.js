const express = require("express");
const request = require("supertest");

jest.mock("../src/models/User", () => ({
    findOne: jest.fn(),
    create: jest.fn()
}));

jest.mock("../src/config/logger", () => ({
    logEvent: jest.fn()
}));

jest.mock("../src/middleware/rateLimiter", () => ({
    authLimiter: (req, res, next) => next()
}));

const User = require("../src/models/User");
const { logEvent } = require("../src/config/logger");
const requestLogger = require("../src/middleware/requestLogger");
const router = require("../src/routes/registration");

const DETAILS = {
    name: "Test",
    surname: "User",
    email: "private.registration@example.com",
    password: "PRIVATE_PASSWORD123!",
    role: "client"
};

const ID = "64b000000000000000000001";

function makeApp() {
    const app = express();
    app.use(requestLogger);
    app.use(express.json());
    app.use(router);
    return app;
}

beforeEach(() => {
    jest.resetAllMocks();
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ ...DETAILS, _id: ID });
});

afterEach(() => {
    const output = JSON.stringify(logEvent.mock.calls);
    expect(output).not.toContain(DETAILS.password);
    expect(output).not.toContain(DETAILS.email);
    expect(output).not.toContain("PRIVATE_DATABASE");
});

describe("Registration event logging", () => {
    test("records successful registration with the created account ID", async () => {
        const res = await request(makeApp())
            .post("/register")
            .send(DETAILS);

        expect(res.status).toBe(201);
        expect(res.body.user.password).toBeUndefined();

        expect(logEvent).toHaveBeenCalledWith(
            "info",
            "auth.registration.success",
            expect.objectContaining({
                actorId: ID,
                requestId: res.headers["x-request-id"]
            })
        );
    });

    test("records validation rejection before database access", async () => {
        const res = await request(makeApp())
            .post("/register")
            .send({ ...DETAILS, role: "admin" });

        expect(res.status).toBe(400);
        expect(User.findOne).not.toHaveBeenCalled();

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "auth.registration.failure",
            expect.objectContaining({
                reason: "validation_failed"
            })
        );
    });

    test("records an existing account without logging its email", async () => {
        User.findOne.mockResolvedValue({ _id: ID });

        const res = await request(makeApp())
            .post("/register")
            .send(DETAILS);

        expect(res.status).toBe(409);
        expect(User.create).not.toHaveBeenCalled();

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "auth.registration.failure",
            expect.objectContaining({
                reason: "email_exists"
            })
        );
    });

    test("records a duplicate-index race as a safe conflict", async () => {
        const error = new Error("PRIVATE_DATABASE");
        error.code = 11000;
        User.create.mockRejectedValue(error);

        const res = await request(makeApp())
            .post("/register")
            .send(DETAILS);

        expect(res.status).toBe(409);
        expect(JSON.stringify(res.body))
            .not.toContain("PRIVATE_DATABASE");
    });

    test("records model validation failures without raw error details", async () => {
        const error = new Error("PRIVATE_DATABASE");
        error.name = "ValidationError";
        User.create.mockRejectedValue(error);

        const res = await request(makeApp())
            .post("/register")
            .send(DETAILS);

        expect(res.status).toBe(400);

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "auth.registration.failure",
            expect.objectContaining({
                reason: "model_validation_failed"
            })
        );

        expect(JSON.stringify(res.body))
            .not.toContain("PRIVATE_DATABASE");
    });

    test("records unexpected database failures with a safe 500 response", async () => {
        User.findOne.mockRejectedValue(
            new Error("PRIVATE_DATABASE")
        );

        const res = await request(makeApp())
            .post("/register")
            .send(DETAILS);

        expect(res.status).toBe(500);

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "auth.registration.error",
            expect.objectContaining({
                reason: "registration_failed"
            })
        );

        expect(JSON.stringify(res.body))
            .not.toContain("PRIVATE_DATABASE");
    });
});