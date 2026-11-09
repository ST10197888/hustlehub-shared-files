const LoginAttempt = require("../src/models/LoginAttempt");

const {
    createLoginProtection
} = require("../src/services/loginProtection");

const EMAIL = "cooldown.test@example.com";
const originalSecret = process.env.JWT_SECRET;

let currentTime;
let protection;

async function lockAccount() {
    for (let index = 0; index < 5; index += 1) {
        await protection.recordFailedLogin(EMAIL);
    }
}

beforeAll(async () => {
    await LoginAttempt.init();
});

beforeEach(async () => {
    await LoginAttempt.deleteMany({});

    currentTime = Date.now();

    process.env.JWT_SECRET =
        "isolated-login-cooldown-test-secret";

    protection = createLoginProtection({
        now: () => currentTime
    });
});

afterEach(async () => {
    await LoginAttempt.deleteMany({});

    if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalSecret;
    }
});

describe("Persistent failed-login cooldown", () => {
    test("allows an identity with no previous failures", async () => {
        expect(
            await protection.getLoginCooldown(EMAIL)
        ).toEqual({
            locked: false,
            failedAttempts: 0,
            retryAfterSeconds: 0
        });

        expect(await LoginAttempt.countDocuments()).toBe(0);
    });

    test("locks for 15 minutes on the fifth failure", async () => {
        for (let index = 1; index <= 4; index += 1) {
            expect(
                await protection.recordFailedLogin(EMAIL)
            ).toEqual({
                locked: false,
                failedAttempts: index,
                retryAfterSeconds: 0
            });
        }

        expect(
            await protection.recordFailedLogin(EMAIL)
        ).toEqual({
            locked: true,
            failedAttempts: 5,
            retryAfterSeconds: 900
        });
    });

    test("successful login clears failures before the account is locked", async () => {
        await protection.recordFailedLogin(EMAIL);
        await protection.recordFailedLogin(EMAIL);

        expect(
            await protection.recordSuccessfulLogin(EMAIL)
        ).toMatchObject({
            locked: false,
            failedAttempts: 0
        });

        expect(
            await protection.recordFailedLogin(EMAIL)
        ).toMatchObject({
            locked: false,
            failedAttempts: 1
        });
    });

    test("successful credentials cannot clear an active cooldown", async () => {
        await lockAccount();

        expect(
            await protection.recordSuccessfulLogin(EMAIL)
        ).toMatchObject({
            locked: true,
            failedAttempts: 5
        });
    });

    test("allows login after cooldown expiry while the stored row still exists", async () => {
        await lockAccount();

        currentTime += 15 * 60 * 1000 + 1;

        expect(await LoginAttempt.countDocuments()).toBe(1);

        expect(
            await protection.getLoginCooldown(EMAIL)
        ).toMatchObject({
            locked: false,
            failedAttempts: 0
        });

        expect(
            await protection.recordSuccessfulLogin(EMAIL)
        ).toMatchObject({
            locked: false,
            failedAttempts: 0
        });
    });

    test("starts a new counter after the observation window expires", async () => {
        await protection.recordFailedLogin(EMAIL);
        await protection.recordFailedLogin(EMAIL);

        currentTime += 15 * 60 * 1000 + 1;

        expect(
            await protection.recordFailedLogin(EMAIL)
        ).toEqual({
            locked: false,
            failedAttempts: 1,
            retryAfterSeconds: 0
        });
    });

    test("shares state across email casing but isolates other accounts", async () => {
        await lockAccount();

        expect(
            await protection.getLoginCooldown(
                "  COOLDOWN.TEST@EXAMPLE.COM  "
            )
        ).toMatchObject({
            locked: true
        });

        expect(
            await protection.getLoginCooldown(
                "another@example.com"
            )
        ).toMatchObject({
            locked: false,
            failedAttempts: 0
        });
    });

    test("blocked attempts do not extend the existing lock deadline", async () => {
        await lockAccount();

        const before = await LoginAttempt.findOne().lean();

        currentTime += 60 * 1000;

        const state = await protection.recordFailedLogin(EMAIL);
        const after = await LoginAttempt.findOne().lean();

        expect(state.retryAfterSeconds).toBe(840);

        expect(after.lockedUntil.getTime())
            .toBe(before.lockedUntil.getTime());
    });

    test("handles simultaneous failed attempts in one persistent record", async () => {
        await Promise.all(
            Array.from(
                { length: 10 },
                () => protection.recordFailedLogin(EMAIL)
            )
        );

        expect(await LoginAttempt.countDocuments()).toBe(1);

        expect(
            await protection.getLoginCooldown(EMAIL)
        ).toMatchObject({
            locked: true,
            failedAttempts: 5
        });
    });

    test("stores a keyed digest instead of the email and configures TTL cleanup", async () => {
        await protection.recordFailedLogin(EMAIL);

        const row = await LoginAttempt.findOne().lean();

        expect(row._id).toMatch(/^[a-f0-9]{64}$/);
        expect(JSON.stringify(row)).not.toContain(EMAIL);

        expect(row.expiresAt.getTime())
            .toBe(currentTime + 30 * 60 * 1000);

        const indexes = await LoginAttempt.collection.indexes();

        expect(indexes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    key: { expiresAt: 1 },
                    expireAfterSeconds: 0
                })
            ])
        );
    });
});