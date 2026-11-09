import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import BrowseGigs from "./pages/Browse";
import GigDetails from "./pages/GigDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CreateGig from "./pages/CreateGig";
import MyBookings from "./pages/MyBookings";
import FreelancerDashboard from "./pages/FreelancerDashboard";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main className="page">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/gigs" element={<BrowseGigs />} />
            <Route path="/gigs/:id" element={<GigDetails />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/create-gig" element={<CreateGig />} />
            <Route path="/bookings" element={<MyBookings />} />
            <Route path="/dashboard" element={<FreelancerDashboard />} />
            <Route path="*" element={<section className="section"><h1>Page not found</h1><p className="muted">That page doesn’t exist.</p></section>} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
