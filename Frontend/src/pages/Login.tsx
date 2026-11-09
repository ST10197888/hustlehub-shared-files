import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { LoginDetails } from "../types/models";

function Login() {
  const { signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginDetails>({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(event: ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!event.currentTarget.checkValidity()) {
      setError("Please complete all required fields with valid values.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(form);
      navigate("/");
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="form-page">
      <p className="eyebrow">Welcome back</p>
      <h1>Log in to HustleHub+</h1>
      {location.state?.message && <p className="notice">{location.state.message}</p>}
      <p className="muted">Sign in to book gigs or manage your services.</p>
      <form className="form-card" noValidate onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required value={form.password} onChange={update} />
        {error && <p className="notice notice-error" role="alert">{error}</p>}
<button type="submit" className="button" disabled={submitting}>{submitting ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="muted">New here? <Link to="/register">Create an account</Link></p>
    </section>
  );
}

export default Login;
