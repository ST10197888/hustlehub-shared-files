import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../services/api";

function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleSignOut() {
    if (signingOut) return;

    setLogoutError("");
    setSigningOut(true);

    try {
      await signOut();
      navigate("/");
    } catch (error) {
      setLogoutError(getApiError(error));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <header className="navbar">
        <Link className="brand" to="/">
          HustleHub+
        </Link>

        <nav>
          <Link to="/gigs">Explore gigs</Link>

          {user?.role === "freelancer" && (
            <Link to="/create-gig">Post a gig</Link>
          )}

          {user?.role === "freelancer" && (
            <Link to="/dashboard">Dashboard</Link>
          )}

          {user?.role === "client" && (
            <Link to="/bookings">My bookings</Link>
          )}

          {user ? (
            <>
              <span className="nav-user">
                Hi, {user.name}
              </span>

              <button
                type="button"
                className="button button-small button-outline"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? "Logging out…" : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>

              <Link
                className="button button-small"
                to="/register"
              >
                Join
              </Link>
            </>
          )}
        </nav>
      </header>

      {logoutError && (
        <p
          className="notice notice-error"
          role="alert"
        >
          {logoutError}
        </p>
      )}
    </>
  );
}

export default Navbar;