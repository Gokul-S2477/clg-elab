import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 px-4 pb-5 pt-[84px] md:px-6 md:pt-[84px] lg:px-8">
          <div className="erp-fade-in mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
