/**
 * Financial calculations for the freelancer dashboard.
 *
 * Everything in this file is a pure function (no database access) so the
 * rules can be unit tested with plain objects.
 *
 * Money is summed in integer cents to avoid floating point drift, and is
 * only converted back to rand at the edge (see centsToRand).
 */

const CURRENCY = "ZAR";

// South Africa is UTC+2 all year (no daylight saving). Tax years and
// monthly buckets are cut at midnight South African time.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * SARS individual income tax tables, keyed by the calendar year in which
 * the tax year STARTS (the 2026 entry is 1 March 2026 - 28 February 2027).
 * Each bracket: income above `from` pays `base` + `rate`% of the excess.
 * Source: SARS "Rates of tax for individuals".
 */
const TAX_TABLES = {
    2025: {
        label: "2025/26",
        primaryRebate: 17235,
        brackets: [
            { from: 0, base: 0, rate: 18 },
            { from: 237100, base: 42678, rate: 26 },
            { from: 370500, base: 77362, rate: 31 },
            { from: 512800, base: 121475, rate: 36 },
            { from: 673000, base: 179147, rate: 39 },
            { from: 857900, base: 251258, rate: 41 },
            { from: 1817000, base: 644489, rate: 45 }
        ]
    },
    2026: {
        label: "2026/27",
        primaryRebate: 17820,
        brackets: [
            { from: 0, base: 0, rate: 18 },
            { from: 245100, base: 44118, rate: 26 },
            { from: 383100, base: 79998, rate: 31 },
            { from: 530200, base: 125599, rate: 36 },
            { from: 695800, base: 185215, rate: 39 },
            { from: 887000, base: 259783, rate: 41 },
            { from: 1878600, base: 666339, rate: 45 }
        ]
    }
};

const SUPPORTED_TAX_YEARS = Object.keys(TAX_TABLES).map(Number).sort((a, b) => a - b);
const LATEST_TAX_YEAR = SUPPORTED_TAX_YEARS[SUPPORTED_TAX_YEARS.length - 1];

/* ----------------------------- money helpers ----------------------------- */

function toCents(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function centsToRand(cents) {
    return Math.round(cents) / 100;
}

/** Rounds a rand value to 2 decimals (half away from zero for positives). */
function roundMoney(value) {
    return centsToRand(toCents(value));
}

/* ------------------------------ date helpers ----------------------------- */

function toSastParts(date) {
    const shifted = new Date(date.getTime() + SAST_OFFSET_MS);
    return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() };
}

function isValidDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    return !Number.isNaN(date.getTime());
}

/** Calendar year in which the SA tax year containing `date` started. */
function getTaxYearStart(date) {
    const { year, month } = toSastParts(new Date(date));
    return month >= 2 ? year : year - 1; // March (index 2) starts a new tax year
}

/** [from, to) bounds of a tax year as UTC instants. */
function getTaxYearBounds(startYear) {
    return {
        from: new Date(Date.UTC(startYear, 2, 1) - SAST_OFFSET_MS),
        to: new Date(Date.UTC(startYear + 1, 2, 1) - SAST_OFFSET_MS)
    };
}

function formatTaxYearLabel(startYear) {
    return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

function getAvailableTaxYears() {
    return SUPPORTED_TAX_YEARS.map((startYear) => ({
        startYear,
        label: TAX_TABLES[startYear].label
    })).reverse();
}

/** The 12 months of a tax year, March first, as { key, label }. */
function getTaxYearMonths(startYear) {
    const months = [];

    for (let i = 0; i < 12; i += 1) {
        const monthIndex = (2 + i) % 12;
        const year = startYear + (2 + i >= 12 ? 1 : 0);
        months.push({
            key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
            label: `${MONTH_NAMES[monthIndex]} ${year}`
        });
    }

    return months;
}

/* ------------------------------ tax estimate ----------------------------- */

/**
 * Estimates income tax on `taxableIncome` (rand) for a resident individual
 * under 65, using the SARS table for the given tax year start.
 *
 * Assumptions (also returned by the API):
 *  - all qualifying booking income is taxable income, no deductions;
 *  - only the primary rebate applies (no age rebates, no medical credits);
 *  - tax is estimated on income earned so far in the tax year, using the
 *    full-year brackets and rebate (no annualising of part-year income).
 *
 * Returns rand values rounded to cents. Negative / invalid income is 0.
 */
function calculateIncomeTax(taxableIncome, startYear = LATEST_TAX_YEAR) {
    const table = TAX_TABLES[startYear] || TAX_TABLES[LATEST_TAX_YEAR];
    const incomeCents = Math.max(0, toCents(taxableIncome));

    if (incomeCents === 0) {
        return {
            grossTax: 0,
            rebate: 0,
            tax: 0,
            marginalRate: 0,
            effectiveRate: 0
        };
    }

    let bracket = table.brackets[0];
    for (const candidate of table.brackets) {
        // Bracket tops are inclusive (R245,100 is still taxed at 18%).
        if (incomeCents > candidate.from * 100) {
            bracket = candidate;
        }
    }

    const grossCents = Math.round(
        bracket.base * 100 + ((incomeCents - bracket.from * 100) * bracket.rate) / 100
    );
    const rebateCents = Math.min(grossCents, table.primaryRebate * 100);
    const taxCents = grossCents - rebateCents;

    return {
        grossTax: centsToRand(grossCents),
        rebate: centsToRand(rebateCents),
        tax: centsToRand(taxCents),
        marginalRate: taxCents === 0 ? 0 : bracket.rate,
        effectiveRate: Math.round((taxCents / incomeCents) * 10000) / 100
    };
}

/* ------------------------- qualifying transactions ----------------------- */

function idOf(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object" && value._id !== undefined) return String(value._id);
    return String(value);
}

/**
 * Decides which transactions count as income for a freelancer.
 *
 * A transaction qualifies only when ALL of these hold:
 *  - it belongs to this freelancer (never trust the caller's query alone);
 *  - its status is "completed";
 *  - its amount is a finite number greater than zero;
 *  - its date is valid;
 *  - it points at a booking that exists, is "confirmed" and also belongs to
 *    this freelancer;
 *  - it is not a duplicate: only the earliest transaction per booking
 *    counts, and a repeated transactionId is ignored.
 *
 * @param {object[]} transactions plain transaction objects
 * @param {object[]} bookings     plain booking objects for those transactions
 * @param {string}   freelancerId authenticated freelancer's id
 * @returns {{ qualifying: object[], excluded: object }}
 */
function selectQualifyingTransactions(transactions, bookings, freelancerId) {
    const owner = idOf(freelancerId);
    const bookingById = new Map();

    for (const booking of Array.isArray(bookings) ? bookings : []) {
        if (booking) bookingById.set(idOf(booking._id), booking);
    }

    const excluded = {
        otherFreelancer: 0,
        notCompleted: 0,
        invalid: 0,
        bookingNotConfirmed: 0,
        duplicate: 0
    };

    const sorted = (Array.isArray(transactions) ? transactions : [])
        .filter(Boolean)
        .slice()
        .sort((a, b) => {
            const left = isValidDate(a.createdAt) ? new Date(a.createdAt).getTime() : Infinity;
            const right = isValidDate(b.createdAt) ? new Date(b.createdAt).getTime() : Infinity;
            return left - right;
        });

    const seenBookings = new Set();
    const seenTransactionIds = new Set();
    const qualifying = [];

    for (const transaction of sorted) {
        if (idOf(transaction.freelancerId) !== owner) {
            excluded.otherFreelancer += 1;
            continue;
        }

        if (transaction.status !== "completed") {
            excluded.notCompleted += 1;
            continue;
        }

        const amount = transaction.amount;
        if (
            typeof amount !== "number" ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            !isValidDate(transaction.createdAt) ||
            !idOf(transaction.bookingId)
        ) {
            excluded.invalid += 1;
            continue;
        }

        const booking = bookingById.get(idOf(transaction.bookingId));
        if (
            !booking ||
            booking.status !== "confirmed" ||
            idOf(booking.freelancerId) !== owner
        ) {
            excluded.bookingNotConfirmed += 1;
            continue;
        }

        const bookingKey = idOf(transaction.bookingId);
        const transactionKey = transaction.transactionId ? String(transaction.transactionId) : "";

        if (
            seenBookings.has(bookingKey) ||
            (transactionKey && seenTransactionIds.has(transactionKey))
        ) {
            excluded.duplicate += 1;
            continue;
        }

        seenBookings.add(bookingKey);
        if (transactionKey) seenTransactionIds.add(transactionKey);

        qualifying.push({ transaction, booking, amountCents: toCents(amount) });
    }

    return { qualifying, excluded };
}

/* ---------------------------- summary assembly --------------------------- */

function buildAssumptions(taxYearLabel, ratesNote) {
    const assumptions = [
        "Income counts completed payments for confirmed bookings only; duplicate, failed, pending and cancelled transactions are excluded.",
        `Period: the South African tax year ${taxYearLabel} (1 March to the end of February), using South African time.`,
        "All booking income is treated as taxable income, with no expenses or deductions.",
        "Calculated as a resident individual under 65 using SARS rates, with only the primary rebate applied.",
        "Tax is estimated on income earned so far this tax year using full-year brackets; it is not annualised.",
        "This is an estimate for planning only and is not tax advice or a SARS assessment."
    ];

    if (ratesNote) assumptions.splice(2, 0, ratesNote);
    return assumptions;
}

/**
 * Builds the financial summary returned by GET /api/financial/summary.
 *
 * @param {object}   input
 * @param {object[]} input.transactions all of the freelancer's transactions
 * @param {object[]} input.bookings     their bookings
 * @param {string}   input.freelancerId authenticated freelancer id
 * @param {number}   [input.taxYear]    tax year start year; defaults to the current one
 * @param {Date}     [input.now]        injectable clock for tests
 */
function buildFinancialSummary({ transactions, bookings, freelancerId, taxYear, now = new Date() }) {
    const startYear = Number.isInteger(taxYear) ? taxYear : getTaxYearStart(now);
    const usesFallbackRates = !TAX_TABLES[startYear];
    const rateYear = usesFallbackRates ? LATEST_TAX_YEAR : startYear;
    const label = formatTaxYearLabel(startYear);
    const { from, to } = getTaxYearBounds(startYear);

    const { qualifying, excluded } = selectQualifyingTransactions(
        transactions,
        bookings,
        freelancerId
    );

    const inPeriod = qualifying.filter(({ transaction }) => {
        const created = new Date(transaction.createdAt);
        return created >= from && created < to;
    });

    const months = getTaxYearMonths(startYear);
    const monthCents = new Map(months.map((month) => [month.key, 0]));
    let totalCents = 0;

    for (const { transaction, amountCents } of inPeriod) {
        const { year, month } = toSastParts(new Date(transaction.createdAt));
        const key = `${year}-${String(month + 1).padStart(2, "0")}`;
        monthCents.set(key, (monthCents.get(key) || 0) + amountCents);
        totalCents += amountCents;
    }

    const tax = calculateIncomeTax(centsToRand(totalCents), rateYear);
    const taxCents = toCents(tax.tax);

    const recentTransactions = inPeriod
        .slice()
        .reverse()
        .slice(0, 5)
        .map(({ transaction, booking, amountCents }) => ({
            transactionId: String(transaction.transactionId || ""),
            gigTitle: booking.gigTitle || "Gig booking",
            amount: centsToRand(amountCents),
            date: new Date(transaction.createdAt).toISOString()
        }));

    return {
        currency: CURRENCY,
        period: {
            taxYear: label,
            startYear,
            from: from.toISOString(),
            to: to.toISOString()
        },
        totalEarnings: centsToRand(totalCents),
        estimatedTax: tax.tax,
        netEstimate: centsToRand(totalCents - taxCents),
        effectiveTaxRate: tax.effectiveRate,
        marginalTaxRate: tax.marginalRate,
        bookingCount: inPeriod.length,
        monthlyEarnings: months.map((month) => ({
            month: month.key,
            label: month.label,
            amount: centsToRand(monthCents.get(month.key) || 0)
        })),
        recentTransactions,
        excludedTransactionCount: Object.values(excluded).reduce((a, b) => a + b, 0),
        availableTaxYears: getAvailableTaxYears(),
        assumptions: buildAssumptions(
            label,
            usesFallbackRates
                ? `SARS rates for ${label} are not loaded yet, so the ${TAX_TABLES[LATEST_TAX_YEAR].label} rates are used.`
                : ""
        )
    };
}

module.exports = {
    CURRENCY,
    TAX_TABLES,
    SUPPORTED_TAX_YEARS,
    toCents,
    centsToRand,
    roundMoney,
    getTaxYearStart,
    getTaxYearBounds,
    getTaxYearMonths,
    getAvailableTaxYears,
    calculateIncomeTax,
    selectQualifyingTransactions,
    buildFinancialSummary
};
