const mongoose = require("mongoose");

jest.mock("../src/models/Transaction", () => ({
    find: jest.fn(),
    aggregate: jest.fn()
}));

jest.mock("../src/models/Booking", () => ({
    find: jest.fn()
}));

jest.mock("../src/services/financialService", () => ({
    SUPPORTED_TAX_YEARS: [2025, 2026],
    buildFinancialSummary: jest.fn()
}));

const Transaction = require("../src/models/Transaction");

const {
    buildFinancialSummary
} = require("../src/services/financialService");

const {
    getFinancialSummary
} = require("../src/controllers/financialController");

const {
    getMyTransactions,
    getFreelancerIncome
} = require("../src/controllers/transactionController");

const OWNER = "64b000000000000000000001";

function makeRequest() {
    return {
        user: { userId: OWNER },
        query: {},
        logEvent: jest.fn()
    };
}

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

function rows(values) {
    return {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(values)
    };
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe("Financial and transaction event privacy", () => {
    test.each([
        [
            "financial summary",
            getFinancialSummary,
            "financial.summary.failed",
            "calculation_failed"
        ],
        [
            "transaction list",
            getMyTransactions,
            "transaction.list.failed",
            "lookup_failed"
        ],
        [
            "freelancer income",
            getFreelancerIncome,
            "transaction.income.failed",
            "calculation_failed"
        ]
    ])(
        "logs %s errors without exposing database details",
        async (name, handler, event, reason) => {
            Transaction.find.mockImplementation(() => {
                throw new Error("PRIVATE_CONNECTION_DETAILS");
            });

            Transaction.aggregate.mockRejectedValue(
                new Error("PRIVATE_CONNECTION_DETAILS")
            );

            const req = makeRequest();
            const res = makeResponse();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);

            expect(req.logEvent).toHaveBeenCalledWith(
                "error",
                event,
                { reason }
            );

            expect(JSON.stringify([
                res.json.mock.calls,
                req.logEvent.mock.calls
            ])).not.toContain("PRIVATE_CONNECTION_DETAILS");
        }
    );

    test("records unsupported years before reading financial data", async () => {
        const req = makeRequest();
        const res = makeResponse();

        req.query.taxYear = "1999";

        await getFinancialSummary(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(Transaction.find).not.toHaveBeenCalled();

        expect(req.logEvent).toHaveBeenCalledWith(
            "warn",
            "financial.summary.rejected",
            { reason: "unsupported_tax_year" }
        );
    });

    test("keeps transaction reads scoped to the authenticated client", async () => {
        Transaction.find.mockReturnValue(rows([]));

        const req = makeRequest();
        const res = makeResponse();

        req.query.clientId = "64b000000000000000000099";

        await getMyTransactions(req, res);

        expect(Transaction.find).toHaveBeenCalledWith({
            clientId: new mongoose.Types.ObjectId(OWNER)
        });

        expect(res.status).toHaveBeenCalledWith(200);

        expect(req.logEvent).toHaveBeenCalledWith(
            "info",
            "transaction.list.viewed"
        );
    });

    test("scopes income to its owner and keeps financial amounts out of events", async () => {
        Transaction.aggregate.mockResolvedValue([
            {
                totalIncome: 1200,
                completedBookings: 2
            }
        ]);

        Transaction.find.mockReturnValue(rows([]));

        const req = makeRequest();
        const res = makeResponse();

        await getFreelancerIncome(req, res);

        const filter =
            Transaction.aggregate.mock.calls[0][0][0].$match;

        expect(String(filter.freelancerId)).toBe(OWNER);
        expect(filter.status).toBe("completed");

        expect(
            res.json.mock.calls[0][0].income.totalIncome
        ).toBe(1200);

        expect(req.logEvent).toHaveBeenCalledWith(
            "info",
            "transaction.income.viewed"
        );

        expect(
            JSON.stringify(req.logEvent.mock.calls)
        ).not.toContain("1200");
    });

    test("records summary access without copying the summary into logs", async () => {
        Transaction.find.mockReturnValue(rows([]));

        buildFinancialSummary.mockReturnValue({
            totalEarnings: 123456.78
        });

        const req = makeRequest();
        const res = makeResponse();

        await getFinancialSummary(req, res);

        expect(res.status).toHaveBeenCalledWith(200);

        expect(req.logEvent).toHaveBeenCalledWith(
            "info",
            "financial.summary.viewed"
        );

        expect(
            JSON.stringify(req.logEvent.mock.calls)
        ).not.toContain("123456.78");
    });
});