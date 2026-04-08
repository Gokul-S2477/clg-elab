import React from "react";
import { getRoleLabel, getStoredUser, isPrivilegedRole } from "../utils/roleHelper";

const Dashboard = () => {
  const user = getStoredUser();

  const cards = [
    { title: "Current Role", value: getRoleLabel(user?.role), accent: "from-blue-600 to-blue-500" },
    { title: "Practice Access", value: isPrivilegedRole(user?.role) ? "Manage + Solve" : "Solve Only", accent: "from-teal-600 to-teal-500" },
    { title: "Session Status", value: "Online", accent: "from-sky-500 to-cyan-400" },
  ];

  return (
    <div className="space-y-6">
      <section className="erp-card erp-grid-bg rounded-[32px] px-6 py-8 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-blue-600">Dashboard</p>
        <h1 className="mt-3 text-4xl font-extrabold text-slate-900">
          Welcome back{user?.name ? `, ${user.name}` : ""}.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500">
          This workspace now uses a lighter ERP shell so the Practice Arena, coding screen, and admin flows all feel
          part of the same product.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {cards.map((card) => (
          <article key={card.title} className="erp-card rounded-[28px] p-5">
            <div className={`inline-flex rounded-full bg-gradient-to-r px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-white ${card.accent}`}>
              {card.title}
            </div>
            <p className="mt-6 text-3xl font-extrabold text-slate-900">{card.value}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

export default Dashboard;
