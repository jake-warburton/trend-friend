import React from "react";
import type { ThesisPreset } from "./types";

export const THESIS_PRESET_ICONS: Record<string, React.ReactNode> = {
  discover: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 2.5v3M10 14.5v3M17.5 10h-3M5.5 10h-3" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  ),
  seo: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.5 12.5L17 17" />
      <path d="M6 8.5h5M8.5 6v5" />
    </svg>
  ),
  content: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 14.5V5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H6.5L3 14.5z" />
      <path d="M7 7h6M7 10h4" />
    </svg>
  ),
  product: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7l6-4 6 4v6l-6 4-6-4V7z" />
      <path d="M4 7l6 4m0 0l6-4m-6 4v7" />
    </svg>
  ),
  new: (
    <svg className="thesis-preset-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3v14M5 8l5-5 5 5" />
    </svg>
  ),
};

export const THESIS_PRESETS: readonly ThesisPreset[] = [
  {
    key: "discover",
    label: "Early discovery",
    description:
      "Bias toward early, fast-moving topics before they validate everywhere.",
    lens: "discovery",
    stage: "nascent",
    hideRecurring: true,
    minimumScore: 12,
  },
  {
    key: "seo",
    label: "SEO opportunities",
    description:
      "Surface search-backed demand with enough evidence breadth to publish into.",
    lens: "seo",
    hideRecurring: true,
    minimumScore: 18,
  },
  {
    key: "content",
    label: "Social content",
    description:
      "Prioritize trends with public conversation and clear creator angles.",
    lens: "content",
    source: "reddit",
    minimumScore: 16,
  },
  {
    key: "product",
    label: "Build ideas",
    description:
      "Tilt toward builder demand, product fit, and non-recurring opportunity.",
    lens: "product",
    audience: "developer",
    hideRecurring: true,
    minimumScore: 16,
  },
  {
    key: "new",
    label: "New this run",
    description:
      "Trends appearing for the first time in the latest snapshot.",
    status: "new",
    sortBy: "dateAdded",
    sortDirection: "desc",
  },
] as const;
