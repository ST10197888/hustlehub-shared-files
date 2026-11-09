import { Link } from "react-router-dom";
import type { Gig } from "../types/models";

type GigCardProps = {
  gig: Gig;
};

function GigCard({ gig }: GigCardProps) {
  return (
    <article className="gig-card">
      <div className="gigcard-content">
        <p className="category">{gig.category}</p>

        <h3>
          <Link to={`/gigs/${gig.id || gig._id}`}>{gig.title}</Link>
        </h3>

        <p className="seller">By {gig.seller}</p>

        <div className="gigcard-footer">
          <span> {gig.rating}</span>
          <strong>From R{gig.price}</strong>
        </div>
      </div>
    </article>
  );
}

export default GigCard;
