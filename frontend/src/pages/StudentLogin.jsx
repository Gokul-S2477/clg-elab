import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/api";
import { saveUser } from "../utils/roleHelper";

const StudentLogin = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          role: "student",
        }),
      });

      if (!response.ok) {
        throw new Error("Invalid student ID or password");
      }

      const payload = await response.json();
      saveUser(payload.user);
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.message || "Unable to login right now");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[36px] border border-[#d8e6ff] bg-white shadow-[0_30px_90px_rgba(37,99,235,0.14)] lg:grid-cols-[1.1fr,0.9fr]">
        <section className="erp-grid-bg hidden bg-gradient-to-br from-blue-600 via-blue-500 to-teal-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-100">ERP Practice</p>
            <h1 className="mt-4 max-w-md text-5xl font-extrabold leading-tight">
              Solve, learn, and grow inside a cleaner coding workspace.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-blue-50">
              Students can jump directly into the Practice Arena, see published questions, and use the code editor and
              console workflow without any clutter.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/20 bg-white/15 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-blue-100">Student ID</p>
              <p className="mt-2 text-xl font-bold">gs9721</p>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/15 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-blue-100">Password</p>
              <p className="mt-2 text-xl font-bold">gs9721</p>
            </div>
            <div className="rounded-3xl border border-white/20 bg-white/15 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.3em] text-blue-100">Access</p>
              <p className="mt-2 text-xl font-bold">Solve Only</p>
            </div>
          </div>
        </section>

        <section className="p-8 sm:p-10">
          <div className="mx-auto max-w-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Student Login</p>
                <h2 className="mt-3 text-4xl font-extrabold text-slate-900">Welcome back</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Sign in to continue into the ERP coding environment.
                </p>
              </div>
              <Link className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700" to="/admin-login">
                Admin Login
              </Link>
            </div>

            <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Student ID</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#f9fbff] px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
                  placeholder="Enter your student ID"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#f9fbff] px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
                  placeholder="Enter password"
                  required
                />
              </div>

              {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Signing in..." : "Enter Practice Arena"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudentLogin;
