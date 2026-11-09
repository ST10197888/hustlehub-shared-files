export type UserRole = "client" | "freelancer";

export interface User {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: UserRole;
}

export interface Gig {
  id: string;
  _id?: string;
  title: string;
  description: string;
  category: string;
  price: number;
  seller: string;
  rating: number | null;
  emoji?: string;
}

export interface BackendGig {
  _id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  freelancer?: string | { name?: string; surname?: string; email?: string };
}

export interface RegisterDetails {
  name: string;
  surname: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginDetails {
  email: string;
  password: string;
}

export interface GigDetailsInput {
  title: string;
  description: string;
  category: string;
  price: number;
}

export interface Booking {
  _id: string;
  gigTitle: string;
  price: number;
  status: string;
  createdAt: string;
  freelancerId?: string | { name?: string; surname?: string };
}

export interface BookingResult {
  success: boolean;
  message: string;
  confirmation: { transactionId: string };
}

export interface MonthlyEarning {
  month: string;
  label: string;
  amount: number;
}

export interface RecentIncome {
  transactionId: string;
  gigTitle: string;
  amount: number;
  date: string;
}

export interface TaxYearOption {
  startYear: number;
  label: string;
}

export interface FinancialSummary {
  currency: string;
  period: { taxYear: string; startYear: number; from: string; to: string };
  totalEarnings: number;
  estimatedTax: number;
  netEstimate: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  bookingCount: number;
  monthlyEarnings: MonthlyEarning[];
  recentTransactions: RecentIncome[];
  excludedTransactionCount: number;
  availableTaxYears: TaxYearOption[];
  assumptions: string[];
}
