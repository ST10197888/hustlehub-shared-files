import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiError, getMyBookings } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { Booking } from "../types/models";

function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "client") {
      setLoading(false);
      return;
    }
    getMyBookings()
      .then(setBookings)
      .catch((requestError) => setError(getApiError(requestError)))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return <section className="section"><h1>Log in to view your bookings</h1><Link className="button" to="/login">Log in</Link></section>;
  if (user.role !== "client") return <section className="section"><h1>Client account required</h1><p className="muted">Bookings are shown for client accounts.</p></section>;

  return (
    <section className="section">
      <p className="eyebrow">Your activity</p>
      <h1>My bookings</h1>
      {loading && <p className="muted">Loading bookings…</p>}
      {error && <p className="notice notice-error">{error}</p>}
      {!loading && !error && bookings.length === 0 && <p className="muted">You haven’t booked a gig yet. <Link to="/gigs">Explore gigs</Link></p>}
      <div className="booking-list">
        {bookings.map((booking) => {
          const freelancer = booking.freelancerId;
          const freelancerName = freelancer && typeof freelancer === "object"
            ? [freelancer.name, freelancer.surname].filter(Boolean).join(" ")
            : "HustleHub freelancer";

          return (
            <article className="booking-item" key={booking._id}>
              <div><h2>{booking.gigTitle}</h2><p className="muted">Freelancer: {freelancerName}</p></div>
              <div className="booking-meta"><strong>R{booking.price}</strong><span>{booking.status}</span><small>{new Date(booking.createdAt).toLocaleDateString()}</small></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default MyBookings;
