import React from "react";

const pathProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const FeaturedTrackGlyph = ({ kind = "reset", className = "" }) => {
  if (kind === "topic") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect x="4" y="5" width="7" height="7" rx="2" {...pathProps} />
        <rect x="13" y="5" width="7" height="7" rx="2" {...pathProps} />
        <rect x="4" y="14" width="7" height="7" rx="2" {...pathProps} />
        <rect x="13" y="14" width="7" height="7" rx="2" {...pathProps} />
      </svg>
    );
  }

  if (kind === "company") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M4 20V8h6V4h4v16" {...pathProps} />
        <path d="M14 20v-8h6v8" {...pathProps} />
        <path d="M8 20v-4" {...pathProps} />
      </svg>
    );
  }

  if (kind === "savedView") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z" {...pathProps} />
      </svg>
    );
  }

  if (kind === "difficulty") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M4 18h16" {...pathProps} />
        <path d="M7 18V10" {...pathProps} />
        <path d="M12 18V6" {...pathProps} />
        <path d="M17 18v-4" {...pathProps} />
      </svg>
    );
  }

  if (kind === "status") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="8" {...pathProps} />
        <path d="m9.5 12.5 1.8 1.8L15 10.6" {...pathProps} />
      </svg>
    );
  }

  if (kind === "progress") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d="M5 19V9" {...pathProps} />
        <path d="M10 19V5" {...pathProps} />
        <path d="M15 19v-7" {...pathProps} />
        <path d="M20 19V7" {...pathProps} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2v4" {...pathProps} />
      <path d="M12 18v4" {...pathProps} />
      <path d="M4.9 4.9l2.8 2.8" {...pathProps} />
      <path d="M16.3 16.3l2.8 2.8" {...pathProps} />
      <path d="M2 12h4" {...pathProps} />
      <path d="M18 12h4" {...pathProps} />
      <path d="M4.9 19.1l2.8-2.8" {...pathProps} />
      <path d="M16.3 7.7l2.8-2.8" {...pathProps} />
    </svg>
  );
};

export default FeaturedTrackGlyph;
