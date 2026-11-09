const {
    calculateIncomeTax,
    selectQualifyingTransactions,
    buildFinancialSummary,
    getTaxYearStart,
    getTaxYearBounds,
    roundMoney
} = require("../src/services/financialService");

const ME = "64b000000000000000000001";
const OTHER = "64b000000000000000000002";

let counter = 0;
function tx(overrides = {}) {
    counter += 1;
    return {
        transactionId: `TXN-${counter}`,
        bookingId: `64c0000000000000000000${String(counter).padStart(2, "0")}`,
        freelancerId: ME,
        amount: 1000,
        status: "completed",
        createdAt: "2026-06-15T10:00:00.000Z",
        ...overrides
    };
}
function booking(transaction, overrides = {}) {
    return {
        _id: transaction.bookingId,
        freelancerId: ME,
        status: "confirmed",
        gigTitle: "Logo design",
        ...overrides
    };
}

describe("calculateIncomeTax (SARS 2026/27 sample cases)", () => {
    test.each([
        // income, expected tax, expected marginal rate
        [0, 0, 0],
        [50000, 0, 0],
        [99000, 0, 0], // tax threshold: 18% equals the primary rebate
        [100000, 180, 18],
        [245100, 26298, 18], // top of first bracket is inclusive
        [245100.01, 26298, 26],
        [360000, 56172, 26],
        [500000, 98417, 31],
        [1000000, 288293, 41],
        [2000000, 703149, 45]
    ])("income R%s gives tax R%s", (income, expectedTax, marginal) => {
        const result = calculateIncomeTax(income, 2026);
        expect(result.tax).toBeCloseTo(expectedTax, 2);
        expect(result.marginalRate).toBe(marginal);
    });

    test("uses the 2025/26 table when asked", () => {
        expect(calculateIncomeTax(360000, 2025).tax).toBe(57397);
    });

    test("falls back to the latest table for unknown years", () => {
        expect(calculateIncomeTax(360000, 2031).tax).toBe(56172);
    });

    test("rounds to cents and reports effective rate", () => {
        const result = calculateIncomeTax(123456.789, 2026);
        expect(Number.isInteger(Math.round(result.tax * 100))).toBe(true);
        expect(result.tax).toBe(roundMoney(result.grossTax - result.rebate));
        expect(result.effectiveRate).toBeGreaterThan(0);
        expect(result.effectiveRate).toBeLessThan(result.marginalRate);
    });

    test.each([[-500], [NaN], [undefined], [null], ["abc"], [Infinity]])(
        "invalid income %p is treated as zero tax",
        (income) => {
            expect(calculateIncomeTax(income, 2026).tax).toBe(0);
        }
    );
});

describe("selectQualifyingTransactions", () => {
    test("counts completed transactions for confirmed bookings", () => {
        const a = tx();
        const b = tx({ amount: 250.5 });
        const { qualifying, excluded } = selectQualifyingTransactions(
            [a, b],
            [booking(a), booking(b)],
            ME
        );
        expect(qualifying).toHaveLength(2);
        expect(Object.values(excluded).every((n) => n === 0)).toBe(true);
    });

    test("excludes pending and failed transactions", () => {
        const pending = tx({ status: "pending" });
        const failed = tx({ status: "failed" });
        const { qualifying, excluded } = selectQualifyingTransactions(
            [pending, failed],
            [booking(pending), booking(failed)],
            ME
        );
        expect(qualifying).toHaveLength(0);
        expect(excluded.notCompleted).toBe(2);
    });

    test("excludes cancelled bookings and transactions with no booking", () => {
        const cancelled = tx();
        const orphan = tx();
        const { qualifying, excluded } = selectQualifyingTransactions(
            [cancelled, orphan],
            [booking(cancelled, { status: "cancelled" })],
            ME
        );
        expect(qualifying).toHaveLength(0);
        expect(excluded.bookingNotConfirmed).toBe(2);
    });

    test.each([
        ["zero amount", { amount: 0 }],
        ["negative amount", { amount: -50 }],
        ["string amount", { amount: "100" }],
        ["NaN amount", { amount: NaN }],
        ["missing amount", { amount: undefined }],
        ["invalid date", { createdAt: "not a date" }],
        ["missing date", { createdAt: undefined }],
        ["missing booking id", { bookingId: undefined }]
    ])("excludes invalid data: %s", (_name, overrides) => {
        const bad = tx(overrides);
        const { qualifying, excluded } = selectQualifyingTransactions(
            [bad],
            [booking(bad)],
            ME
        );
        expect(qualifying).toHaveLength(0);
        expect(excluded.invalid).toBe(1);
    });

    test("counts only the earliest transaction per booking", () => {
        const first = tx({ createdAt: "2026-06-01T08:00:00.000Z", amount: 500 });
        const second = tx({
            bookingId: first.bookingId,
            createdAt: "2026-06-01T09:00:00.000Z",
            amount: 500
        });
        const { qualifying, excluded } = selectQualifyingTransactions(
            [second, first], // order must not matter
            [booking(first)],
            ME
        );
        expect(qualifying).toHaveLength(1);
        expect(qualifying[0].transaction.transactionId).toBe(first.transactionId);
        expect(excluded.duplicate).toBe(1);
    });

    test("ignores a repeated transactionId", () => {
        const a = tx({ transactionId: "TXN-SAME" });
        const b = tx({ transactionId: "TXN-SAME" });
        const { qualifying, excluded } = selectQualifyingTransactions(
            [a, b],
            [booking(a), booking(b)],
            ME
        );
        expect(qualifying).toHaveLength(1);
        expect(excluded.duplicate).toBe(1);
    });

    test("never counts another freelancer's transactions or bookings", () => {
        const theirs = tx({ freelancerId: OTHER });
        const mine = tx();
        const bookedWithOther = tx();
        const { qualifying, excluded } = selectQualifyingTransactions(
            [theirs, mine, bookedWithOther],
            [
                booking(theirs, { freelancerId: OTHER }),
                booking(mine),
                booking(bookedWithOther, { freelancerId: OTHER })
            ],
            ME
        );
        expect(qualifying).toHaveLength(1);
        expect(qualifying[0].transaction.transactionId).toBe(mine.transactionId);
        expect(excluded.otherFreelancer).toBe(1);
        expect(excluded.bookingNotConfirmed).toBe(1);
    });

    test("handles missing arrays without throwing", () => {
        expect(selectQualifyingTransactions(undefined, undefined, ME).qualifying).toEqual([]);
        expect(selectQualifyingTransactions([null], [null], ME).qualifying).toEqual([]);
    });
});

describe("tax year helpers", () => {
    test("tax year starts on 1 March South African time", () => {
        expect(getTaxYearStart(new Date("2026-03-01T00:00:00+02:00"))).toBe(2026);
        expect(getTaxYearStart(new Date("2026-02-28T23:59:59+02:00"))).toBe(2025);
        expect(getTaxYearStart(new Date("2026-11-08T12:00:00+02:00"))).toBe(2026);
        expect(getTaxYearStart(new Date("2027-01-15T12:00:00+02:00"))).toBe(2026);
    });

    test("bounds are [1 March, next 1 March) in SAST", () => {
        const { from, to } = getTaxYearBounds(2026);
        expect(from.toISOString()).toBe("2026-02-28T22:00:00.000Z");
        expect(to.toISOString()).toBe("2027-02-28T22:00:00.000Z");
    });
});

describe("buildFinancialSummary", () => {
    const now = new Date("2026-11-08T10:00:00+02:00");

    function build(transactions, extra = {}) {
        return buildFinancialSummary({
            transactions,
            bookings: transactions.map((t) => booking(t)),
            freelancerId: ME,
            now,
            ...extra
        });
    }

    test("zero income returns zeros and a full 12 month series", () => {
        const summary = build([]);
        expect(summary).toMatchObject({
            currency: "ZAR",
            totalEarnings: 0,
            estimatedTax: 0,
            netEstimate: 0,
            effectiveTaxRate: 0,
            bookingCount: 0,
            recentTransactions: []
        });
        expect(summary.period.taxYear).toBe("2026/27");
        expect(summary.monthlyEarnings).toHaveLength(12);
        expect(summary.monthlyEarnings[0].label).toBe("Mar 2026");
        expect(summary.monthlyEarnings[11].label).toBe("Feb 2027");
        expect(summary.monthlyEarnings.every((m) => m.amount === 0)).toBe(true);
    });

    test("totals, tax and net add up for a worked example", () => {
        const summary = build([
            tx({ amount: 200000, createdAt: "2026-04-10T10:00:00.000Z" }),
            tx({ amount: 160000, createdAt: "2026-09-10T10:00:00.000Z" })
        ]);
        expect(summary.totalEarnings).toBe(360000);
        expect(summary.estimatedTax).toBe(56172);
        expect(summary.netEstimate).toBe(303828);
        expect(summary.effectiveTaxRate).toBe(15.6);
        expect(summary.marginalTaxRate).toBe(26);
        expect(summary.bookingCount).toBe(2);
    });

    test("pennies are summed without floating point drift", () => {
        const items = [0.1, 0.2, 0.3].map((amount) => tx({ amount }));
        const summary = build(items);
        expect(summary.totalEarnings).toBe(0.6);
        expect(summary.netEstimate + summary.estimatedTax).toBeCloseTo(summary.totalEarnings, 10);
    });

    test("excludes income outside the chosen tax year", () => {
        const summary = build([
            tx({ amount: 700, createdAt: "2026-02-28T21:59:59.000Z" }), // last second of 2025/26
            tx({ amount: 900, createdAt: "2026-02-28T22:00:00.000Z" }) // first second of 2026/27
        ]);
        expect(summary.totalEarnings).toBe(900);
        expect(build(
            [tx({ amount: 700, createdAt: "2026-02-28T21:59:59.000Z" })],
            { taxYear: 2025 }
        ).totalEarnings).toBe(700);
    });

    test("buckets earnings by month in South African time", () => {
        const summary = build([
            tx({ amount: 100, createdAt: "2026-05-31T22:30:00.000Z" }), // already 1 June in SAST
            tx({ amount: 50, createdAt: "2026-05-15T10:00:00.000Z" })
        ]);
        const byMonth = Object.fromEntries(summary.monthlyEarnings.map((m) => [m.month, m.amount]));
        expect(byMonth["2026-05"]).toBe(50);
        expect(byMonth["2026-06"]).toBe(100);
    });

    test("duplicates and invalid rows do not inflate income", () => {
        const good = tx({ amount: 400 });
        const dup = tx({ bookingId: good.bookingId, amount: 400 });
        const failed = tx({ status: "failed", amount: 999 });
        const summary = buildFinancialSummary({
            transactions: [good, dup, failed],
            bookings: [booking(good), booking(failed)],
            freelancerId: ME,
            now
        });
        expect(summary.totalEarnings).toBe(400);
        expect(summary.excludedTransactionCount).toBe(2);
    });

    test("recent transactions are newest first, capped at 5, without client ids", () => {
        const items = Array.from({ length: 7 }, (_, i) =>
            tx({ amount: 100 + i, createdAt: `2026-07-0${i + 1}T10:00:00.000Z`, clientId: "secret" })
        );
        const summary = build(items);
        expect(summary.recentTransactions).toHaveLength(5);
        expect(summary.recentTransactions[0].amount).toBe(106);
        expect(JSON.stringify(summary)).not.toMatch(/secret|clientId/);
    });

    test("uses the latest rates and says so for a tax year with no table", () => {
        const summary = build([], { now: new Date("2027-04-01T10:00:00+02:00") });
        expect(summary.period.taxYear).toBe("2027/28");
        expect(summary.assumptions.join(" ")).toMatch(/not loaded yet/);
    });

    test("lists explicit assumptions", () => {
        const text = build([]).assumptions.join(" ");
        expect(text).toMatch(/under 65/);
        expect(text).toMatch(/primary rebate/);
        expect(text).toMatch(/not tax advice/);
    });
});
