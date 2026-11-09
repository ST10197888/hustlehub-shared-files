import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MemoryRouter } from "react-router-dom";
import FreelancerDashboard from "../pages/FreelancerDashboard";
import IncomeChart from "../components/IncomeChart";
import { useAuth } from "../context/AuthContext";
import { getApiError, getFinancialSummary } from "../services/api";
import { formatPercent, formatRand } from "../utils/money";

jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../services/api", () => ({
  getFinancialSummary: jest.fn(),
  getApiError: jest.fn()
}));

// getByText normalises whitespace, so compare against a plain-space amount.
const text = (amount) => amount.replace(/\u00A0/g, " ");

const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];

function makeSummary(overrides = {}) {
  return {
    currency: "ZAR",
    period: { taxYear: "2026/27", startYear: 2026, from: "2026-02-28T22:00:00.000Z", to: "2027-02-28T22:00:00.000Z" },
    totalEarnings: 120000,
    estimatedTax: 3780,
    netEstimate: 116220,
    effectiveTaxRate: 3.15,
    marginalTaxRate: 18,
    bookingCount: 2,
    monthlyEarnings: months.map((name, index) => ({
      month: `2026-${String(index + 1).padStart(2, "0")}`,
      label: `${name} ${index < 10 ? 2026 : 2027}`,
      amount: index === 1 ? 80000 : index === 5 ? 40000 : 0
    })),
    recentTransactions: [
      { transactionId: "TXN-1", gigTitle: "Website build", amount: 80000, date: "2026-04-10T10:00:00.000Z" }
    ],
    excludedTransactionCount: 1,
    availableTaxYears: [
      { startYear: 2026, label: "2026/27" },
      { startYear: 2025, label: "2025/26" }
    ],
    assumptions: ["Primary rebate only.", "Estimate, not tax advice."],
    ...overrides
  };
}

const zeroSummary = makeSummary({
  totalEarnings: 0,
  estimatedTax: 0,
  netEstimate: 0,
  effectiveTaxRate: 0,
  marginalTaxRate: 0,
  bookingCount: 0,
  monthlyEarnings: months.map((name, index) => ({ month: `2026-${index + 1}`, label: `${name} 2026`, amount: 0 })),
  recentTransactions: []
});

function renderDashboard() {
  return render(<MemoryRouter><FreelancerDashboard /></MemoryRouter>);
}

describe("formatting helpers", () => {
  test("formatRand groups thousands and always shows cents", () => {
    expect(formatRand(0)).toBe("R0.00");
    expect(formatRand(1234.5)).toBe("R1\u00A0234.50");
    expect(formatRand(116220)).toBe("R116\u00A0220.00");
    expect(formatRand(0.1 + 0.2)).toBe("R0.30");
  });

  test("formatRand and formatPercent are safe with bad input", () => {
    expect(formatRand(undefined)).toBe("R0.00");
    expect(formatRand(NaN)).toBe("R0.00");
    expect(formatRand("12")).toBe("R0.00");
    expect(formatRand(-5)).toBe("-R5.00");
    expect(formatPercent(null)).toBe("0%");
    expect(formatPercent(15.6)).toBe("15.6%");
  });
});

describe("FreelancerDashboard", () => {
  beforeEach(() => {
    useAuth.mockReset();
    getFinancialSummary.mockReset();
    getApiError.mockReset();
    getApiError.mockReturnValue("Could not load your earnings.");
    useAuth.mockReturnValue({ user: { id: "f1", name: "Sam", role: "freelancer" } });
  });

  afterEach(cleanup);

  test("asks signed-out visitors to log in without calling the API", () => {
    useAuth.mockReturnValue({ user: null });
    renderDashboard();
    expect(screen.getByRole("heading", { name: "Log in to view your dashboard" })).toBeInTheDocument();
    expect(getFinancialSummary).not.toHaveBeenCalled();
  });

  test("blocks client accounts without calling the API", () => {
    useAuth.mockReturnValue({ user: { id: "c1", role: "client" } });
    renderDashboard();
    expect(screen.getByRole("heading", { name: "Freelancer account required" })).toBeInTheDocument();
    expect(getFinancialSummary).not.toHaveBeenCalled();
  });

  test("shows a loading state, then earnings, estimated tax and net estimate", async () => {
    getFinancialSummary.mockResolvedValue(makeSummary());
    renderDashboard();

    expect(screen.getByText("Loading your earnings…")).toBeInTheDocument();

    const earnings = await screen.findByLabelText("Total earnings");
    expect(within(earnings).getByText(text("R120\u00A0000.00"))).toBeInTheDocument();
    expect(within(earnings).getByText(/2 confirmed bookings/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Estimated tax")).getByText(text("R3\u00A0780.00"))).toBeInTheDocument();
    expect(within(screen.getByLabelText("Estimated tax")).getByText("3.15% effective rate")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Net estimate")).getByText(text("R116\u00A0220.00"))).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Monthly earnings for the 2026\/27 tax year/ })).toBeInTheDocument();
    expect(screen.getByText("Website build")).toBeInTheDocument();
    expect(getFinancialSummary).toHaveBeenCalledWith(undefined);
  });

  test("shows zero values, an empty chart and a prompt when there is no income", async () => {
    getFinancialSummary.mockResolvedValue(zeroSummary);
    renderDashboard();

    const earnings = await screen.findByLabelText("Total earnings");
    expect(within(earnings).getByText("R0.00")).toBeInTheDocument();
    expect(within(earnings).getByText(/0 confirmed bookings/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Estimated tax")).getByText("No tax on R0.00")).toBeInTheDocument();
    expect(screen.getByText("No earnings to chart yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Post a gig" })).toHaveAttribute("href", "/create-gig");
    expect(screen.queryByRole("img", { name: /Monthly earnings/ })).not.toBeInTheDocument();
  });

  test("shows an error with a retry button when the API call fails, then recovers", async () => {
    const user = userEvent.setup();
    getFinancialSummary.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(makeSummary());
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your earnings.");
    expect(screen.queryByLabelText("Total earnings")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText("Total earnings")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(getFinancialSummary).toHaveBeenCalledTimes(2);
  });

  test("requests the chosen tax year when the filter changes", async () => {
    const user = userEvent.setup();
    getFinancialSummary
      .mockResolvedValueOnce(makeSummary())
      .mockResolvedValueOnce(makeSummary({
        period: { taxYear: "2025/26", startYear: 2025, from: "", to: "" },
        totalEarnings: 500,
        netEstimate: 500,
        estimatedTax: 0
      }));
    renderDashboard();

    const select = await screen.findByLabelText("Tax year");
    expect(select).toHaveValue("2026");
    await user.selectOptions(select, "2025");

    expect(getFinancialSummary).toHaveBeenLastCalledWith(2025);
    expect(await screen.findByText(/confirmed booking?s?, 2025\/26/)).toBeInTheDocument();
  });

  test("lists the assumptions behind the estimate", async () => {
    getFinancialSummary.mockResolvedValue(makeSummary());
    renderDashboard();

    await screen.findByLabelText("Total earnings");
    expect(screen.getByText("How is this estimated?")).toBeInTheDocument();
    expect(screen.getByText("Primary rebate only.")).toBeInTheDocument();
  });
});

describe("IncomeChart", () => {
  afterEach(cleanup);

  const data = [
    { month: "2026-03", label: "Mar 2026", amount: 1000 },
    { month: "2026-04", label: "Apr 2026", amount: 2500.5 },
    { month: "2026-05", label: "May 2026", amount: 0 }
  ];

  test("renders one accessible bar per month", () => {
    render(<IncomeChart data={data} taxYear="2026/27" />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Apr 2026: R2\u00A0500.50" })).toBeInTheDocument();
  });

  test("selecting a bar shows that month's amount and toggles off again", async () => {
    const user = userEvent.setup();
    render(<IncomeChart data={data} taxYear="2026/27" />);

    expect(screen.getByText(/Select a month/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Apr 2026/ }));
    expect(screen.getByRole("button", { name: /Apr 2026/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Apr 2026")).toBeInTheDocument();
    expect(screen.getByText(/R2 500\.50/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Apr 2026/ }));
    expect(screen.getByText(/Select a month/)).toBeInTheDocument();
  });

  test("bars can be operated with the keyboard", async () => {
    const user = userEvent.setup();
    render(<IncomeChart data={data} taxYear="2026/27" />);

    screen.getByRole("button", { name: /Mar 2026/ }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /Mar 2026/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("shows an empty state for all-zero, empty or missing data", () => {
    const { rerender } = render(<IncomeChart data={[{ month: "m", label: "Mar 2026", amount: 0 }]} taxYear="2026/27" />);
    expect(screen.getByText("No earnings to chart yet")).toBeInTheDocument();
    rerender(<IncomeChart data={[]} taxYear="2026/27" />);
    expect(screen.getByText("No earnings to chart yet")).toBeInTheDocument();
    rerender(<IncomeChart data={undefined} taxYear="2026/27" />);
    expect(screen.getByText("No earnings to chart yet")).toBeInTheDocument();
  });

  test("treats invalid amounts as zero instead of breaking", () => {
    render(<IncomeChart data={[{ month: "a", label: "Mar 2026", amount: NaN }, { month: "b", label: "Apr 2026", amount: 300 }]} taxYear="2026/27" />);
    expect(screen.getByRole("button", { name: "Mar 2026: R0.00" })).toBeInTheDocument();
  });
});
