import { Link } from "react-router-dom";
import GigCard from "../components/GigCard";
import { useEffect, useState } from "react";
import { getApiError, getGigs } from "../services/api";
import type { Gig } from "../types/models";

function Home() {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGigs()
      .then(setGigs)
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">A marketplace for people with something to offer</p>
        <h1>Find a skill.<br />Make something happen.</h1>
        <p>Discover creative services from talented people in your community.</p>
        <Link className="button" to="/gigs">Explore gigs</Link>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Handpicked for you</p>
            <h2>Popular gigs</h2>
          </div>
          <Link to="/gigs">See all gigs →</Link>
        </div>

        <div className="gig-grid">
          {loading && <p className="muted">Loading gigs…</p>}
          {error && <p className="notice notice-error">{error}</p>}
          {!loading && !error && gigs.length === 0 && <p className="muted">No gigs yet. Check back soon.</p>}
          {gigs.slice(0, 3).map((gig) => <GigCard key={gig.id} gig={gig} />)}
        </div>
      </section>
    </>
  );
}

export default Home;
