const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

jest.mock("../src/config/logger", () => ({
    logEvent: jest.fn()
}));

jest.mock("../src/middleware/rateLimiter", () => {
    const pass = (req, res, next) => next();

    return {
        authLimiter: pass,
        bookingLimiter: pass,
        generalLimiter: pass
    };
});

const app = require("../src/app");
const User = require("../src/models/User");
const RevokedSession = require("../src/models/RevokedSession");
const { logEvent } = require("../src/config/logger");

const {
    issueAccessToken,
    verifyAccessToken
} = require("../src/services/sessionSecurity");

const DETAILS = {
    name: "Session",
    surname: "Client",
    email: "session.api@example.com",
    password: "TestPass123!",
    role: "client"
};

let user;
let token;
let passwordHash;

beforeAll(async () => {
    passwordHash = await bcrypt.hash(DETAILS.password, 10);
    await RevokedSession.init();
});

beforeEach(async () => {
    jest.clearAllMocks();

    user = await User.create({
        ...DETAILS,
        password: passwordHash
    });

    token = issueAccessToken(user);
});

afterEach(() => {
    jest.restoreAllMocks();
});

function profile(accessToken = token) {
    return request(app)
        .get("/profile")
        .set("Authorization", `Bearer ${accessToken}`);
}

function logout(accessToken = token, path = "/logout") {
    return request(app)
        .post(path)
        .set("Authorization", `Bearer ${accessToken}`);
}

describe("Session validation and logout API", () => {
    test("login issues the required session claims and prevents response caching", async () => {
        const res = await request(app)
            .post("/login")
            .send({
                email: DETAILS.email,
                password: DETAILS.password
            });

        expect(res.status).toBe(200);

        expect(verifyAccessToken(res.body.token)).toMatchObject({
            userId: user._id.toString(),
            jti: expect.any(String),
            exp: expect.any(Number)
        });

        expect(res.headers["cache-control"]).toBe("no-store");
    });

    test("allows active sessions into protected routes without caching the response", async () => {
        const res = await profile();

        expect(res.status).toBe(200);
        expect(res.body.user.userId).toBe(user._id.toString());
        expect(res.headers["cache-control"]).toBe("no-store");
    });

    test("logout revokes the session and rejects replay of its token", async () => {
        const res = await logout();

        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toBe("no-store");
        expect((await profile()).status).toBe(401);

        expect(await RevokedSession.countDocuments()).toBe(1);

        expect(logEvent).toHaveBeenCalledWith(
            "info",
            "auth.logout.success",
            expect.objectContaining({
                actorId: user._id.toString(),
                requestId: res.headers["x-request-id"]
            })
        );

        expect(JSON.stringify(logEvent.mock.calls))
            .not.toContain(token);
    });

    test("keeps another independently issued session active", async () => {
        const second = issueAccessToken(user);

        expect(second).not.toBe(token);

        await logout();

        expect((await profile()).status).toBe(401);
        expect((await profile(second)).status).toBe(200);
    });

    test("supports the /api/auth/logout alias", async () => {
        const res = await logout(token, "/api/auth/logout");

        expect(res.status).toBe(200);
        expect((await profile()).status).toBe(401);
    });

    test("rejects unauthenticated logout without writing a revocation", async () => {
        const res = await request(app).post("/logout");

        expect(res.status).toBe(401);
        expect(await RevokedSession.countDocuments()).toBe(0);
    });

    test("rejects expired tokens without revoking the active session", async () => {
        const expired = jwt.sign(
            {
                ...verifyAccessToken(token),
                exp: 1
            },
            process.env.JWT_SECRET,
            { algorithm: "HS256" }
        );

        expect((await logout(expired)).status).toBe(401);
        expect(await RevokedSession.countDocuments()).toBe(0);
        expect((await profile()).status).toBe(200);
    });

    test("rejects forged tokens without writing revocations", async () => {
        const forged = jwt.sign(
            { ...verifyAccessToken(token) },
            "wrong-secret",
            { algorithm: "HS256" }
        );

        expect((await logout(forged)).status).toBe(401);
        expect(await RevokedSession.countDocuments()).toBe(0);
    });

    test("blocks protected access when revocation lookup is unavailable", async () => {
        jest.spyOn(RevokedSession, "exists").mockRejectedValue(
            new Error("PRIVATE_DATABASE_DETAILS")
        );

        const res = await profile();

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(false);

        expect(JSON.stringify([
            res.body,
            logEvent.mock.calls
        ])).not.toContain("PRIVATE_DATABASE_DETAILS");
    });

    test("reports failed logout persistence and leaves the token usable", async () => {
        jest.spyOn(RevokedSession, "updateOne").mockRejectedValue(
            new Error("PRIVATE_WRITE_DETAILS")
        );

        const res = await logout();

        expect(res.status).toBe(503);
        expect((await profile()).status).toBe(200);

        expect(JSON.stringify([
            res.body,
            logEvent.mock.calls
        ])).not.toContain("PRIVATE_WRITE_DETAILS");
    });

    test("ignores attempts to revoke another session through request-body fields", async () => {
        const second = issueAccessToken(user);

        const res = await logout().send({
            token: second,
            userId: "64b000000000000000000099",
            jti: verifyAccessToken(second).jti
        });

        expect(res.status).toBe(200);
        expect((await profile()).status).toBe(401);
        expect((await profile(second)).status).toBe(200);
    });

    test("rejects repeated use of a logged-out token", async () => {
        await logout();

        expect((await logout()).status).toBe(401);
        expect(await RevokedSession.countDocuments()).toBe(1);
    });

    test("allows a fresh login after the previous session was revoked", async () => {
        await logout();

        const res = await request(app)
            .post("/login")
            .send({
                email: DETAILS.email,
                password: DETAILS.password
            });

        expect(res.status).toBe(200);
        expect((await profile(res.body.token)).status).toBe(200);
        expect((await profile()).status).toBe(401);
    });

    test.each([
        { iss: "unexpected-issuer" },
        { aud: "unexpected-audience" },
        { jti: "not-a-server-session" }
    ])("rejects invalid session claims: %j", async (change) => {
        const invalid = jwt.sign(
            {
                ...verifyAccessToken(token),
                ...change
            },
            process.env.JWT_SECRET,
            { algorithm: "HS256" }
        );

        expect((await profile(invalid)).status).toBe(401);
    });
});