const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

jest.mock("../src/models/User", () => ({
    findOne: jest.fn()
}));
jest.mock("../src/services/loginProtection", () => ({
    getLoginCooldown: jest.fn().mockResolvedValue({
        locked: false
    }),
    recordFailedLogin: jest.fn().mockResolvedValue({
        locked: false
    }),
    recordSuccessfulLogin: jest.fn().mockResolvedValue({
        locked: false
    })
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
const errorHandler = require("../src/middleware/errorHandler");
const loginRouter = require("../src/routes/login");

const USER_ID = "64b000000000000000000001";

const credentials = {
    email: "login.logging@example.com",
    password: "TestPass123!"
};

const originalSecret = process.env.JWT_SECRET;

let passwordHash;

function makeApp() {
    const app = express();

    app.use(requestLogger);
    app.use(express.json());
    app.use("/api/auth", loginRouter);
    app.use(loginRouter);
    app.use(errorHandler);

    return app;
}

beforeAll(async () => {
    passwordHash = await bcrypt.hash(credentials.password, 10);
});

beforeEach(() => {
    jest.clearAllMocks();

    process.env.JWT_SECRET = "isolated-login-logging-test-secret";

    User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
            _id: USER_ID,
            name: "Test",
            surname: "User",
            email: credentials.email,
            role: "client",
            password: passwordHash
        })
    });
});

afterAll(() => {
    if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalSecret;
    }
});

describe("Login event logging", () => {
    test("logs successful login with the request and account IDs", async () => {
        const res = await request(makeApp())
            .post("/api/auth/login")
            .send(credentials);

        expect(res.status).toBe(200);

        expect(
            jwt.verify(res.body.token, process.env.JWT_SECRET).userId
        ).toBe(USER_ID);

        expect(logEvent).toHaveBeenCalledWith(
            "info",
            "auth.login.success",
            expect.objectContaining({
                actorId: USER_ID,
                requestId: res.headers["x-request-id"]
            })
        );

        const output = JSON.stringify(logEvent.mock.calls);

        expect(output).not.toContain(credentials.password);
        expect(output).not.toContain(credentials.email);
        expect(output).not.toContain(res.body.token);
    });

    test("logs incorrect passwords without identifying the target account", async () => {
        const res = await request(makeApp())
            .post("/login")
            .send({
                ...credentials,
                password: "WrongPassword123!"
            });

        expect(res.status).toBe(401);

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "auth.login.failure",
            expect.objectContaining({
                reason: "invalid_credentials"
            })
        );

        expect(JSON.stringify(logEvent.mock.calls))
            .not.toContain(USER_ID);
    });

    test("uses the same rejection for nonexistent accounts", async () => {
        User.findOne.mockReturnValue({
            select: jest.fn().mockResolvedValue(null)
        });

        const res = await request(makeApp())
            .post("/login")
            .send(credentials);

        expect(res.status).toBe(401);
        expect(res.body.message).toBe("Incorrect email or password.");

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "auth.login.failure",
            expect.objectContaining({
                reason: "invalid_credentials"
            })
        );
    });

    test("logs invalid input without logging the submitted payload", async () => {
        const res = await request(makeApp())
            .post("/login")
            .send({
                email: "PRIVATE_INVALID_EMAIL",
                password: "PRIVATE_PASSWORD"
            });

        expect(res.status).toBe(400);
        expect(User.findOne).not.toHaveBeenCalled();

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "auth.login.failure",
            expect.objectContaining({
                reason: "validation_failed"
            })
        );

        expect(JSON.stringify(logEvent.mock.calls))
            .not.toMatch(/PRIVATE_/);
    });

    test("logs missing JWT configuration with a safe response", async () => {
        delete process.env.JWT_SECRET;

        const res = await request(makeApp())
            .post("/login")
            .send(credentials);

        expect(res.status).toBe(500);
        expect(User.findOne).not.toHaveBeenCalled();

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "auth.login.error",
            expect.objectContaining({
                reason: "jwt_configuration_missing"
            })
        );
    });

    test("logs database failures without exposing raw exception details", async () => {
        User.findOne.mockReturnValue({
            select: jest.fn().mockRejectedValue(
                new Error("PRIVATE_CONNECTION")
            )
        });

        const res = await request(makeApp())
            .post("/login")
            .send(credentials);

        expect(res.status).toBe(500);

        expect(logEvent).toHaveBeenCalledWith(
            "error",
            "auth.login.error",
            expect.objectContaining({
                reason: "authentication_failed"
            })
        );

        expect(JSON.stringify([res.body, logEvent.mock.calls]))
            .not.toContain("PRIVATE_CONNECTION");
    });

    test("preserves the original login route alias", async () => {
        const res = await request(makeApp())
            .post("/login")
            .send(credentials);

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });
});