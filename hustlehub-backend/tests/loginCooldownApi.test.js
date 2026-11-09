const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");

jest.mock("../src/config/logger", () => ({
    logEvent: jest.fn()
}));

// Isolate account cooldown from the separate request-rate limiter.
jest.mock("../src/middleware/rateLimiter", () => ({
    authLimiter: (req, res, next) => next()
}));

const User = require("../src/models/User");
const LoginAttempt = require("../src/models/LoginAttempt");
const { logEvent } = require("../src/config/logger");

const {
    recordFailedLogin,
    getLoginCooldown
} = require("../src/services/loginProtection");

const requestLogger = require("../src/middleware/requestLogger");
const errorHandler = require("../src/middleware/errorHandler");
const loginRouter = require("../src/routes/login");

const EMAIL = "cooldown.api@example.com";
const OTHER_EMAIL = "other.cooldown@example.com";
const PASSWORD = "TestPass123!";

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

async function lockAccount(email = EMAIL) {
    for (let index = 0; index < 5; index += 1) {
        await recordFailedLogin(email);
    }
}

beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 10);
    await LoginAttempt.init();
});

beforeEach(async () => {
    jest.clearAllMocks();

    await User.create([
        {
            name: "Test",
            surname: "Client",
            email: EMAIL,
            password: passwordHash,
            role: "client"
        },
        {
            name: "Other",
            surname: "Client",
            email: OTHER_EMAIL,
            password: passwordHash,
            role: "client"
        }
    ]);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("Login cooldown API", () => {
    test("returns 401 four times, then 429 with a retry interval", async () => {
        const app = makeApp();

        for (let index = 0; index < 4; index += 1) {
            const res = await request(app)
                .post("/login")
                .send({
                    email: EMAIL,
                    password: "WrongPassword123!"
                });

            expect(res.status).toBe(401);
        }

        const res = await request(app)
            .post("/login")
            .send({
                email: EMAIL,
                password: "WrongPassword123!"
            });

        expect(res.status).toBe(429);

        expect(Number(res.headers["retry-after"]))
            .toBeGreaterThan(0);

        expect(Number(res.headers["retry-after"]))
            .toBeLessThanOrEqual(900);

        expect(res.body.retryAfterSeconds)
            .toBe(Number(res.headers["retry-after"]));

        expect(res.body.token).toBeUndefined();
    });

    test("blocks correct credentials while cooldown is active", async () => {
        await lockAccount();

        const lookup = jest.spyOn(User, "findOne");

        const res = await request(makeApp())
            .post("/login")
            .send({ email: EMAIL, password: PASSWORD });

        expect(res.status).toBe(429);
        expect(lookup).not.toHaveBeenCalled();
        expect(res.body.token).toBeUndefined();
    });

    test("allows another account while the first account is blocked", async () => {
        await lockAccount();

        const res = await request(makeApp())
            .post("/login")
            .send({
                email: OTHER_EMAIL,
                password: PASSWORD
            });

        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
    });

    test("shares failure counts between both login route aliases", async () => {
        const app = makeApp();

        for (let index = 0; index < 5; index += 1) {
            const path = index < 2
                ? "/login"
                : "/api/auth/login";

            const res = await request(app)
                .post(path)
                .send({
                    email: EMAIL,
                    password: "WrongPassword123!"
                });

            expect(res.status).toBe(index < 4 ? 401 : 429);
        }
    });

    test("successful login resets earlier failed attempts", async () => {
        const app = makeApp();

        for (let index = 0; index < 3; index += 1) {
            await request(app)
                .post("/login")
                .send({
                    email: EMAIL,
                    password: "WrongPassword123!"
                });
        }

        const success = await request(app)
            .post("/login")
            .send({ email: EMAIL, password: PASSWORD });

        expect(success.status).toBe(200);

        const failed = await request(app)
            .post("/login")
            .send({
                email: EMAIL,
                password: "WrongPassword123!"
            });

        expect(failed.status).toBe(401);

        expect(await getLoginCooldown(EMAIL))
            .toMatchObject({ failedAttempts: 1 });
    });

    test("allows valid credentials when persisted cooldown timestamps have expired", async () => {
        await lockAccount();

        const past = new Date(Date.now() - 1000);

        await LoginAttempt.updateMany({}, {
            $set: {
                lockedUntil: past,
                resetAt: past
            }
        });

        const res = await request(makeApp())
            .post("/login")
            .send({ email: EMAIL, password: PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.token).toEqual(expect.any(String));
    });

    test("applies the same failure and cooldown responses to unknown accounts", async () => {
        const app = makeApp();

        for (let index = 0; index < 5; index += 1) {
            const res = await request(app)
                .post("/login")
                .send({
                    email: "unknown.cooldown@example.com",
                    password: PASSWORD
                });

            expect(res.status).toBe(index < 4 ? 401 : 429);

            if (index < 4) {
                expect(res.body.message)
                    .toBe("Incorrect email or password.");
            }
        }
    });

    test("fails safely without issuing a token if protection storage fails", async () => {
        jest.spyOn(LoginAttempt, "findById").mockReturnValue({
            lean: jest.fn().mockRejectedValue(
                new Error("PRIVATE_DATABASE_DETAILS")
            )
        });

        const res = await request(makeApp())
            .post("/login")
            .send({ email: EMAIL, password: PASSWORD });

        expect(res.status).toBe(500);
        expect(res.body.token).toBeUndefined();

        expect(JSON.stringify([
            res.body,
            logEvent.mock.calls
        ])).not.toContain("PRIVATE_DATABASE_DETAILS");
    });

    test("blocked requests do not extend the cooldown deadline", async () => {
        await lockAccount();

        const before = await LoginAttempt.findOne().lean();

        await request(makeApp())
            .post("/login")
            .send({ email: EMAIL, password: PASSWORD });

        const after = await LoginAttempt.findOne().lean();

        expect(after.lockedUntil.getTime())
            .toBe(before.lockedUntil.getTime());
    });

    test("does not create account cooldown records for malformed input", async () => {
        const res = await request(makeApp())
            .post("/login")
            .send({
                email: "invalid-email",
                password: PASSWORD
            });

        expect(res.status).toBe(400);
        expect(await LoginAttempt.countDocuments()).toBe(0);
    });

    test("logs cooldown denial with a request ID and no credentials", async () => {
        await lockAccount();

        const res = await request(makeApp())
            .post("/api/auth/login")
            .send({ email: EMAIL, password: PASSWORD });

        expect(res.status).toBe(429);

        expect(logEvent).toHaveBeenCalledWith(
            "warn",
            "auth.login.blocked",
            expect.objectContaining({
                requestId: res.headers["x-request-id"],
                reason: "cooldown_active",
                retryAfterSeconds: expect.any(Number)
            })
        );

        const output = JSON.stringify(logEvent.mock.calls);

        expect(output).not.toContain(EMAIL);
        expect(output).not.toContain(PASSWORD);
    });
});