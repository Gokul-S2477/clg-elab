import React from "react";

const formatSavedLabel = (value) => {
  if (!value) return "Not saved yet";
  const savedDate = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(savedDate.getTime())) return "Saved";
  return `Saved ${savedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const SaveStatusBadge = ({ value, tone = "default" }) => {
  const toneClass = tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {formatSavedLabel(value)}
    </span>
  );
};

export default SaveStatusBadge;
