import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { createBooking, getApiError, getGig } from "../services/api";
import { useAuth } from "../context/AuthContext";

function GigDetails() {
    const { id } = useParams();
    const { user } = useAuth();
    const [gig, setGig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notes, setNotes] = useState("");
    const [message, setMessage] = useState("");
    const [booking, setBooking] = useState(false);

    useEffect(() => {
        getGig(id)
            .then(setGig)
            .catch((requestError) => setError(getApiError(requestError)))
            .finally(() => setLoading(false));
    }, [id]);

    async function handleBooking(event) {
        event.preventDefault();
        setBooking(true);
        setMessage("");
        try {
            const result = await createBooking(gig.id, notes);
            setMessage(`${result.message} Confirmation: ${result.confirmation.transactionId}`);
            setNotes("");
        } catch (requestError) {
            setMessage(getApiError(requestError));
        } finally {
            setBooking(false);
        }
    }

    if (loading) return <section className="section"><p className="muted">Loading gig…</p></section>;

    if (error || !gig) {
        return (
            <section className="section">
                <h1>{error ? "Could not load this gig" : "Gig not found"}</h1>
                {error && <p className="notice notice-error">{error}</p>}
                <Link to="/gigs">Back to gigs</Link>
            </section>
        );
    }

return (
    <section className="details">
        <div className="details-art" aria-hidden="true">{gig.emoji || "✦"}</div>
        <div>
            <p className="eyebrow">{gig.category}</p>
            <h1>{gig.title}</h1>
            <p className="seller">By {gig.seller}</p>
            <p>{gig.description}</p>
            <div className="price-box">
                <strong>From R{gig.price}</strong>
                {user?.role === "client" ? (
                    <form className="booking-form" onSubmit={handleBooking}>
                        <label htmlFor="booking-notes">Notes for the freelancer (optional)</label>
                        <textarea id="booking-notes" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
                        <button type="submit" className="button" disabled={booking}>{booking ? "Booking…" : "Book this gig"}</button>
                    </form>
                ) : !user ? <Link className="button" to="/login">Log in to book</Link> : <span className="muted">Freelancer account</span>}
            </div>
            {message && <p className="notice">{message}</p>}
            <Link to="/gigs"> Back to Gigs</Link>
        </div>
    </section>
);
}

export default GigDetails
