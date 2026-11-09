import axios from "axios";
import { attachStoredToken, logoutSession } from "./session";
import type {
  BackendGig,
  Booking,
  BookingResult,
  FinancialSummary,
  Gig,
  GigDetailsInput,
  LoginDetails,
  RegisterDetails,
  User,
} from "../types/models";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(attachStoredToken);

function displayGig(gig: BackendGig): Gig {
  const freelancer = gig.freelancer;
  const seller = freelancer && typeof freelancer === "object"
    ? [freelancer.name, freelancer.surname].filter(Boolean).join(" ")
    : "HustleHub freelancer";

  return { ...gig, id: gig._id, seller, rating: null };
}

export async function getGigs(): Promise<Gig[]> {
  const { data } = await api.get<{ data: BackendGig[] }>("/api/gigs");
  return (data.data || []).map(displayGig);
}

export async function getGig(id: string): Promise<Gig> {
  const { data } = await api.get<{ data: BackendGig }>(`/api/gigs/${id}`);
  return displayGig(data.data);
}

export async function login(credentials: LoginDetails): Promise<User> {
  const { data } = await api.post<{ token: string; user: User }>("/login", credentials);
  localStorage.setItem("hustlehub_token", data.token);
  localStorage.setItem("hustlehub_user", JSON.stringify(data.user));
  return data.user;
}

export async function register(details: RegisterDetails): Promise<User> {
  const { data } = await api.post<{ user: User }>("/register", details);
  return data.user;
}

export async function createGig(details: GigDetailsInput): Promise<Gig> {
  const { data } = await api.post<{ data: BackendGig }>("/api/gigs", details);
  return displayGig(data.data);
}

export async function createBooking(gigId: string, notes = ""): Promise<BookingResult> {
  const { data } = await api.post<BookingResult>("/api/bookings", { gigId, notes });
  return data;
}

export async function getMyBookings(): Promise<Booking[]> {
  const { data } = await api.get<{ bookings: Booking[] }>("/api/bookings/my");
  return data.bookings || [];
}

export async function getFinancialSummary(taxYear?: number): Promise<FinancialSummary> {
  const { data } = await api.get<{ summary: FinancialSummary }>("/api/financial/summary", {
    params: taxYear ? { taxYear } : undefined,
  });
  if (!data || !data.summary) throw new Error("Financial summary was missing from the response.");
  return data.summary;
}

export async function logout(): Promise<void> {
  await logoutSession(api);
}

export function getStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem("hustlehub_user") || "null") as User | null;
  } catch {
    return null;
  }
}

export function getApiError(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; errors?: { msg: string }[] }>(error)) {
    const body = error.response?.data;
    if (body?.message) return body.message;
    if (body?.errors?.length) return body.errors.map((item) => item.msg).join(" ");
    if (error.code === "ERR_NETWORK") {
      return "Could not reach the API. Check that the backend is running at http://localhost:5000.";
    }
  }
  return "Something went wrong. Please try again.";
}

export default api;
