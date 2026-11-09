import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import IncomeChart from "../components/IncomeChart";
import { useAuth } from "../context/AuthContext";
import { getApiError, getFinancialSummary } from "../services/api";
import type { FinancialSummary } from "../types/models";
import { formatPercent, formatRand } from "../utils/money";

function FreelancerDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [taxYear, setTaxYear] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const isFreelancer = user?.role === "freelancer";

  const load = useCallback(async (year?: number) => {
    setLoading(true);
    setError("");
    try {
      setSummary(await getFinancialSummary(year));
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isFreelancer) {
      setLoading(false);
      return;
    }
    load(taxYear);
  }, [isFreelancer, taxYear, load]);

  if (!user) return <section className="section"><h1>Log in to view your dashboard</h1><Link className="button" to="/login">Log in</Link></section>;
  if (!isFreelancer) return <section className="section"><h1>Freelancer account required</h1><p className="muted">The earnings dashboard is available to freelancer accounts.</p></section>;

  const hasEarnings = !!summary && summary.totalEarnings > 0;

  return (
    <section className="section dashboard">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your earnings</p>
          <h1>Freelancer dashboard</h1>
        </div>
        {summary && summary.availableTaxYears.length > 0 && (
          <div className="dashboard-filter">
            <label htmlFor="taxYear">Tax year</label>
            <select
              id="taxYear"
              value={taxYear ?? summary.period.startYear}
              disabled={loading}
              onChange={(event) => setTaxYear(Number(event.target.value))}
            >
              {summary.availableTaxYears.map((option) => (
                <option key={option.startYear} value={option.startYear}>{option.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <p className="muted" role="status">Loading your earnings…</p>}

      {error && (
        <div className="notice notice-error" role="alert">
          <p>{error}</p>
          <button className="button button-small button-outline" onClick={() => load(taxYear)}>Try again</button>
        </div>
      )}

      {summary && !error && (
        <div aria-busy={loading}>
          <div className="stat-grid">
            <article className="stat-card" aria-label="Total earnings">
              <p className="stat-label">Total earnings</p>
              <p className="stat-value">{formatRand(summary.totalEarnings)}</p>
              <p className="muted">{summary.bookingCount} confirmed {summary.bookingCount === 1 ? "booking" : "bookings"}, {summary.period.taxYear}</p>
            </article>
            <article className="stat-card" aria-label="Estimated tax">
              <p className="stat-label">Estimated tax</p>
              <p className="stat-value">{formatRand(summary.estimatedTax)}</p>
              <p className="muted">{hasEarnings ? `${formatPercent(summary.effectiveTaxRate)} effective rate` : "No tax on R0.00"}</p>
            </article>
            <article className="stat-card stat-card-accent" aria-label="Net estimate">
              <p className="stat-label">Net estimate</p>
              <p className="stat-value">{formatRand(summary.netEstimate)}</p>
              <p className="muted">Earnings after estimated tax</p>
            </article>
          </div>

          <div className="panel">
            <h2>Monthly earnings</h2>
            <IncomeChart data={summary.monthlyEarnings} taxYear={summary.period.taxYear} />
          </div>

          {!hasEarnings && (
            <p className="notice">You have no earnings in {summary.period.taxYear} yet. <Link to="/create-gig">Post a gig</Link> to start getting booked.</p>
          )}

          {summary.recentTransactions.length > 0 && (
            <div className="panel">
              <h2>Recent payments</h2>
              <ul className="payment-list">
                {summary.recentTransactions.map((payment) => (
                  <li key={payment.transactionId}>
                    <span><strong>{payment.gigTitle}</strong><small className="muted"> {new Date(payment.date).toLocaleDateString()}</small></span>
                    <strong>{formatRand(payment.amount)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="panel assumptions">
            <summary>How is this estimated?</summary>
            <ul>
              {summary.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}

export default FreelancerDashboard;
