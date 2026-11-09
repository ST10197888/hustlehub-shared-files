import GigCard from "../components/GigCard";

import { useEffect, useState } from "react";
import { getApiError, getGigs } from "../services/api";
import type { Gig } from "../types/models";

function BrowseGigs() {
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
    <section className="section">
      <p className="eyebrow">Discover something new</p>
      

      <h1>Explore gigs</h1>
      <p className="muted">Browse services offered by our community.</p>

      {loading && <p className="muted">Loading gigs…</p>}
      {error && <p className="notice notice-error">{error}</p>}
      {!loading && !error && gigs.length === 0 && <p className="muted">No gigs have been posted yet.</p>}
      {!error && <div className="gig-grid">{gigs.map((gig) => <GigCard key={gig.id} gig={gig} />)}</div>}
    
    </section>
  );
}

export default BrowseGigs;
