import React from "react";

const PageLoader = ({ label = "Loading workspace..." }) => (
  <div className="rounded-[28px] border border-slate-200 bg-white/90 px-6 py-12 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
    <div className="flex flex-col items-center justify-center gap-4 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">Preparing</p>
        <p className="mt-2 text-sm text-slate-600">{label}</p>
      </div>
    </div>
  </div>
);

export default PageLoader;
