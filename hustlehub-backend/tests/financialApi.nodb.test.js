const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/models/Transaction", () => ({ find: jest.fn() }));
jest.mock("../src/models/RevokedSession", () => ({
    exists: jest.fn().mockResolvedValue(null)
}));
jest.mock("../src/models/Booking", () => ({ find: jest.fn() }));
// Keep the app from throttling the test run.
jest.mock("../src/middleware/rateLimiter", () => {
    const pass = (req, res, next) => next();
    return { authLimiter: pass, bookingLimiter: pass, generalLimiter: pass };
});

const app = require("../src/app");
const Transaction = require("../src/models/Transaction");
const Booking = require("../src/models/Booking");

const FREELANCER_A = "64b000000000000000000001";
const FREELANCER_B = "64b000000000000000000002";
const CLIENT = "64b000000000000000000003";

function tokenFor(userId, role, options = {}) {
    return jwt.sign(
        {
            userId,
            email: `${role}@example.com`,
            role
        },
        options.secret || process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            expiresIn: "1h",
            issuer: "hustlehub-api",
            audience: "hustlehub-web",
            jwtid: require("node:crypto").randomUUID(),
            ...options.sign
        }
    );
}

// Mimics Model.find(...).select(...).lean() and records the filter.
function mockFind(Model, rows) {
    Model.find.mockImplementation(() => ({
        select: () => ({ lean: () => Promise.resolve(rows) })
    }));
}

function currentTaxYearDate() {
    return new Date().toISOString();
}

beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-financial-api";
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    console.error.mockRestore();
});

describe("GET /api/financial/summary", () => {
    test("rejects requests without a token", async () => {
        const res = await request(app).get("/api/financial/summary");
        expect(res.status).toBe(401);
        expect(Transaction.find).not.toHaveBeenCalled();
    });

    test("rejects an invalid token", async () => {
        const res = await request(app)
            .get("/api/financial/summary")
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer", { secret: "wrong" })}`);
        expect(res.status).toBe(401);
    });

    test("rejects an expired token", async () => {
        const expired = tokenFor(FREELANCER_A, "freelancer", { sign: { expiresIn: -10 } });
        const res = await request(app)
            .get("/api/financial/summary")
            .set("Authorization", `Bearer ${expired}`);
        expect(res.status).toBe(401);
    });

    test("rejects client accounts", async () => {
        const res = await request(app)
            .get("/api/financial/summary")
            .set("Authorization", `Bearer ${tokenFor(CLIENT, "client")}`);
        expect(res.status).toBe(403);
        expect(Transaction.find).not.toHaveBeenCalled();
    });

    test("returns zeros when the freelancer has no transactions", async () => {
        mockFind(Transaction, []);
        const res = await request(app)
            .get("/api/financial/summary")
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer")}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.summary).toMatchObject({
            currency: "ZAR",
            totalEarnings: 0,
            estimatedTax: 0,
            netEstimate: 0,
            bookingCount: 0
        });
        expect(res.body.summary.monthlyEarnings).toHaveLength(12);
        expect(Booking.find).not.toHaveBeenCalled();
    });

    test("only queries the authenticated freelancer, ignoring query-string ids", async () => {
        mockFind(Transaction, []);
        await request(app)
            .get(`/api/financial/summary?freelancerId=${FREELANCER_B}&userId=${FREELANCER_B}`)
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer")}`);

        const filter = Transaction.find.mock.calls[0][0];
        expect(String(filter.freelancerId)).toBe(FREELANCER_A);
        expect(JSON.stringify(filter)).not.toContain(FREELANCER_B);
    });

    test("also scopes the booking lookup to the freelancer", async () => {
        const bookingId = "64c000000000000000000001";
        mockFind(Transaction, [{
            transactionId: "TXN-1",
            bookingId,
            freelancerId: FREELANCER_A,
            amount: 500,
            status: "completed",
            createdAt: currentTaxYearDate()
        }]);
        mockFind(Booking, []);

        await request(app)
            .get("/api/financial/summary")
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer")}`);

        const filter = Booking.find.mock.calls[0][0];
        expect(String(filter.freelancerId)).toBe(FREELANCER_A);
    });

    test("never returns another freelancer's money even if the data layer leaks it", async () => {
        const mine = "64c000000000000000000001";
        const theirs = "64c000000000000000000002";
        const created = currentTaxYearDate();
        mockFind(Transaction, [
            { transactionId: "TXN-MINE", bookingId: mine, freelancerId: FREELANCER_A, amount: 300, status: "completed", createdAt: created },
            { transactionId: "TXN-THEIRS", bookingId: theirs, freelancerId: FREELANCER_B, amount: 9999, status: "completed", createdAt: created }
        ]);
        mockFind(Booking, [
            { _id: mine, freelancerId: FREELANCER_A, status: "confirmed", gigTitle: "Mine" },
            { _id: theirs, freelancerId: FREELANCER_B, status: "confirmed", gigTitle: "Theirs" }
        ]);

        const res = await request(app)
            .get("/api/financial/summary")
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer")}`);

        expect(res.status).toBe(200);
        expect(res.body.summary.totalEarnings).toBe(300);
        expect(JSON.stringify(res.body)).not.toMatch(/TXN-THEIRS|Theirs/);
    });

    test("calculates earnings, tax and net for qualifying bookings only", async () => {
        const ids = ["64c000000000000000000001", "64c000000000000000000002", "64c000000000000000000003"];
        const created = currentTaxYearDate();
        mockFind(Transaction, [
            { transactionId: "TXN-1", bookingId: ids[0], freelancerId: FREELANCER_A, amount: 120000, status: "completed", createdAt: created },
            { transactionId: "TXN-2", bookingId: ids[1], freelancerId: FREELANCER_A, amount: 5000, status: "failed", createdAt: created },
            { transactionId: "TXN-3", bookingId: ids[2], freelancerId: FREELANCER_A, amount: 7000, status: "completed", createdAt: created }
        ]);
        mockFind(Booking, [
            { _id: ids[0], freelancerId: FREELANCER_A, status: "confirmed", gigTitle: "Website" },
            { _id: ids[1], freelancerId: FREELANCER_A, status: "confirmed", gigTitle: "Logo" },
            { _id: ids[2], freelancerId: FREELANCER_A, status: "cancelled", gigTitle: "Poster" }
        ]);

        const res = await request(app)
            .get("/api/financial/summary")
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer")}`);

        expect(res.status).toBe(200);
        const { summary } = res.body;
        expect(summary.totalEarnings).toBe(120000);
        // 18% of R120,000 = R21,600, less the R17,820 primary rebate
        expect(summary.estimatedTax).toBe(3780);
        expect(summary.netEstimate).toBe(116220);
        expect(summary.bookingCount).toBe(1);
        expect(summary.excludedTransactionCount).toBe(2);
        expect(summary.recentTransactions[0].gigTitle).toBe("Website");
    });

    test("rejects an unsupported taxYear", async () => {
        const res = await request(app)
            .get("/api/financial/summary?taxYear=1999")
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer")}`);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(Transaction.find).not.toHaveBeenCalled();
    });

    test("rejects a malformed taxYear", async () => {
        const res = await request(app)
            .get("/api/financial/summary?taxYear=abc")
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer")}`);
        expect(res.status).toBe(400);
    });

    test("accepts a supported taxYear", async () => {
        mockFind(Transaction, []);
        const res = await request(app)
            .get("/api/financial/summary?taxYear=2025")
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer")}`);
        expect(res.status).toBe(200);
        expect(res.body.summary.period.taxYear).toBe("2025/26");
    });

    test("returns a safe 500 without leaking internals when the database fails", async () => {
        Transaction.find.mockImplementation(() => {
            throw new Error("connection string mongodb://secret");
        });
        const res = await request(app)
            .get("/api/financial/summary")
            .set("Authorization", `Bearer ${tokenFor(FREELANCER_A, "freelancer")}`);
        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            success: false,
            message: "Unable to calculate your financial summary."
        });
    });
});
