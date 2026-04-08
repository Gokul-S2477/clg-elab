import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const MainLayout = () => (
  <div className="min-h-screen bg-transparent text-slate-900">
    <Sidebar />
    <div className="flex min-h-screen flex-col xl:pl-72">
      <Navbar />
      <main className="flex-1 px-4 py-5 md:px-6 lg:px-8">
        <div className="erp-fade-in mx-auto w-full max-w-[1600px]">
          <Outlet />
        </div>
      </main>
    </div>
  </div>
);

export default MainLayout;
