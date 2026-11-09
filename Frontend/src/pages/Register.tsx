import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiError, register } from "../services/api";
import type { RegisterDetails } from "../types/models";

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterDetails>({ name: "", surname: "", email: "", password: "", role: "client" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
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
      await register(form);
      navigate("/login", { state: { message: "Account created. Log in to continue." } });
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="form-page">
      <p className="eyebrow">Join the community</p>
      <h1>Create your account</h1>
      <p className="muted">Choose whether you want to hire or offer a service.</p>
      <form className="form-card" noValidate onSubmit={handleSubmit}>
        <div className="form-row">
          <div><label htmlFor="name">First name</label><input id="name" name="name" autoComplete="given-name" required maxLength={100} value={form.name} onChange={update} /></div>
          <div><label htmlFor="surname">Surname</label><input id="surname" name="surname" autoComplete="family-name" required maxLength={100} value={form.surname} onChange={update} /></div>
        </div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={update} />
        <small className="muted">Use at least 8 characters, with an uppercase letter, a number, and a symbol.</small>
        <label htmlFor="role">I want to</label>
        <select id="role" name="role" value={form.role} onChange={update}>
          <option value="client">Hire someone (client)</option>
          <option value="freelancer">Offer services (freelancer)</option>
        </select>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <button type="submit" className="button" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
    </section>
  );
}

export default Register;
