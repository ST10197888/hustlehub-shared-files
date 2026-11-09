import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createGig, getApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { GigDetailsInput } from "../types/models";

function CreateGig() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", category: "", price: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return <section className="section"><h1>Log in to post a gig</h1><Link className="button" to="/login">Log in</Link></section>;
  if (user.role !== "freelancer") return <section className="section"><h1>Freelancer account required</h1><p className="muted">Only freelancer accounts can post gigs.</p></section>;

  function update(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const details: GigDetailsInput = { ...form, price: Number(form.price) };
      const gig = await createGig(details);
      navigate(`/gigs/${gig.id}`);
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="form-page form-page-wide">
      <p className="eyebrow">Share what you do</p>
      <h1>Post a gig</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        <label htmlFor="title">Gig title</label>
        <input id="title" name="title" required maxLength={120} value={form.title} onChange={update} placeholder="I will design a modern website" />
        <label htmlFor="category">Category</label>
        <input id="category" name="category" required value={form.category} onChange={update} placeholder="Web design" />
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" required rows={5} value={form.description} onChange={update} />
        <label htmlFor="price">Price (R)</label>
        <input id="price" name="price" type="number" min="0" step="0.01" required value={form.price} onChange={update} />
        {error && <p className="notice notice-error">{error}</p>}
        <button type="submit" className="button" disabled={submitting}>{submitting ? "Posting…" : "Publish gig"}</button>
      </form>
    </section>
  );
}

export default CreateGig;
