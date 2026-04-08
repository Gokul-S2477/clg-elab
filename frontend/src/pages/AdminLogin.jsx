import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/api";
import { saveUser } from "../utils/roleHelper";

const roles = [
  { label: "Super Admin", value: "super_admin", id: "superadmin", password: "superadmin@123" },
  { label: "Admin", value: "admin", id: "admin", password: "admin@123" },
  { label: "Faculty", value: "faculty", id: "faculty", password: "faculty@123" },
];

const AdminLogin = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(roles[0].value);
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
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        throw new Error("Invalid admin credentials");
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
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[36px] border border-[#d8e6ff] bg-white shadow-[0_30px_90px_rgba(37,99,235,0.14)] lg:grid-cols-[0.95fr,1.05fr]">
        <section className="p-8 sm:p-10">
          <div className="mx-auto max-w-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">Admin Login</p>
                <h2 className="mt-3 text-4xl font-extrabold text-slate-900">Management Access</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Sign in to create questions, edit hidden cases, and manage published content.
                </p>
              </div>
              <Link className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700" to="/">
                Student Login
              </Link>
            </div>

            <form className="mt-10 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Role</label>
                <select
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#f9fbff] px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
                >
                  {roles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">ID</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="w-full rounded-2xl border border-[#d8e6ff] bg-[#f9fbff] px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
                  placeholder="Enter admin ID"
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
                {isLoading ? "Signing in..." : "Open Admin Workspace"}
              </button>
            </form>
          </div>
        </section>

        <section className="erp-grid-bg hidden bg-gradient-to-br from-teal-600 via-teal-500 to-blue-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-teal-50">Admin Credentials</p>
            <h1 className="mt-4 text-5xl font-extrabold leading-tight">Question operations stay in one focused panel.</h1>
            <p className="mt-6 max-w-lg text-base leading-8 text-teal-50">
              Faculty, admins, and super admins all use the same portal, with CRUD controls layered on top of the
              Practice Arena experience.
            </p>
          </div>

          <div className="space-y-4">
            {roles.map((role) => (
              <div key={role.value} className="rounded-3xl border border-white/20 bg-white/15 p-5 backdrop-blur">
                <p className="text-sm font-bold">{role.label}</p>
                <p className="mt-2 text-sm text-teal-50">ID: {role.id}</p>
                <p className="mt-1 text-sm text-teal-50">Password: {role.password}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminLogin;
