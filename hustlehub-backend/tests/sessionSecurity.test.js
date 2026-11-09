const jwt = require("jsonwebtoken");
const RevokedSession = require("../src/models/RevokedSession");

const {
    issueAccessToken,
    verifyAccessToken,
    isSessionRevoked,
    revokeSession,
    TOKEN_ISSUER,
    TOKEN_AUDIENCE
} = require("../src/services/sessionSecurity");

const USER = {
    _id: "64b000000000000000000001",
    email: "session.test@example.com",
    role: "client"
};

beforeAll(async () => {
    await RevokedSession.init();
});

beforeEach(async () => {
    await RevokedSession.deleteMany({});
});

afterEach(async () => {
    jest.restoreAllMocks();
    await RevokedSession.deleteMany({});
});

describe("Persistent session revocation", () => {
    test("issues expiring tokens with issuer, audience and unique session IDs", () => {
        const first = verifyAccessToken(issueAccessToken(USER));
        const second = verifyAccessToken(issueAccessToken(USER));

        expect(first).toMatchObject({
            userId: USER._id,
            iss: TOKEN_ISSUER,
            aud: TOKEN_AUDIENCE,
            jti: expect.any(String),
            exp: expect.any(Number)
        });

        expect(first.exp).toBeGreaterThan(first.iat);
        expect(first.jti).not.toBe(second.jti);
    });

    test("allows an active session with no revocation record", async () => {
        const claims = verifyAccessToken(issueAccessToken(USER));

        expect(await isSessionRevoked(claims)).toBe(false);
    });

    test("persists revocation without storing the bearer token or email", async () => {
        const token = issueAccessToken(USER);
        const claims = verifyAccessToken(token);

        await revokeSession(claims);

        expect(await isSessionRevoked(claims)).toBe(true);

        const row = await RevokedSession.findOne().lean();

        expect(row._id).toMatch(/^[a-f0-9]{64}$/);
        expect(row.expiresAt.getTime()).toBe(claims.exp * 1000);
        expect(JSON.stringify(row)).not.toContain(token);
        expect(JSON.stringify(row)).not.toContain(USER.email);
    });

    test("keeps independently authenticated sessions usable", async () => {
        const first = verifyAccessToken(issueAccessToken(USER));
        const second = verifyAccessToken(issueAccessToken(USER));

        await revokeSession(first);

        expect(await isSessionRevoked(first)).toBe(true);
        expect(await isSessionRevoked(second)).toBe(false);
    });

    test("repeated revocation preserves the original record and expiry", async () => {
        const claims = verifyAccessToken(issueAccessToken(USER));

        await revokeSession(claims);

        const before = await RevokedSession.findOne().lean();

        await revokeSession(claims);

        const after = await RevokedSession.findOne().lean();

        expect(await RevokedSession.countDocuments()).toBe(1);

        expect(after.revokedAt.getTime())
            .toBe(before.revokedAt.getTime());

        expect(after.expiresAt.getTime())
            .toBe(before.expiresAt.getTime());
    });

    test("handles concurrent revocations in one record", async () => {
        const claims = verifyAccessToken(issueAccessToken(USER));

        await Promise.all(
            Array.from(
                { length: 10 },
                () => revokeSession(claims)
            )
        );

        expect(await RevokedSession.countDocuments()).toBe(1);
        expect(await isSessionRevoked(claims)).toBe(true);
    });

    test("identifies the same signed session across token representations", async () => {
        const original = verifyAccessToken(issueAccessToken(USER));

        const alternative = jwt.sign(
            { ...original },
            process.env.JWT_SECRET,
            {
                algorithm: "HS256",
                header: { kid: "test-representation" }
            }
        );

        await revokeSession(original);

        expect(
            await isSessionRevoked(
                verifyAccessToken(alternative)
            )
        ).toBe(true);
    });

    test("configures cleanup at the signed token expiry", async () => {
        const claims = verifyAccessToken(issueAccessToken(USER));

        await revokeSession(claims);

        const indexes = await RevokedSession.collection.indexes();

        expect(indexes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    key: { expiresAt: 1 },
                    expireAfterSeconds: 0
                })
            ])
        );
    });

    test("rejects tokens without an expiry", () => {
        const payload = jwt.decode(issueAccessToken(USER));

        delete payload.exp;

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { algorithm: "HS256" }
        );

        expect(() => verifyAccessToken(token)).toThrow();
    });

    test("rejects invalid session IDs and unexpected issuers or audiences", () => {
        for (const change of [
            { jti: "not-a-server-session-id" },
            { iss: "another-issuer" },
            { aud: "another-audience" }
        ]) {
            const payload = {
                ...jwt.decode(issueAccessToken(USER)),
                ...change
            };

            const token = jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { algorithm: "HS256" }
            );

            expect(() => verifyAccessToken(token)).toThrow();
        }
    });

    test("propagates revocation lookup failures rather than allowing access", async () => {
        const claims = verifyAccessToken(issueAccessToken(USER));

        jest.spyOn(RevokedSession, "exists").mockRejectedValue(
            new Error("Revocation storage unavailable")
        );

        await expect(
            isSessionRevoked(claims)
        ).rejects.toThrow();
    });

    test("propagates failed revocation writes", async () => {
        const claims = verifyAccessToken(issueAccessToken(USER));

        jest.spyOn(RevokedSession, "updateOne").mockRejectedValue(
            new Error("Revocation storage unavailable")
        );

        await expect(
            revokeSession(claims)
        ).rejects.toThrow();
    });
});