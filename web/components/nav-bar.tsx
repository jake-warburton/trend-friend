"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Explorer", href: "/explore" },
  { label: "Settings", href: "/settings" },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const navClassName = pathname === "/explore" ? "nav-bar nav-bar-static nav-bar-blend" : "nav-bar";

  return (
    <nav className={navClassName}>
      <Link className="nav-bar-brand" href="/explore">
        <span className="nav-bar-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 256 256" role="presentation" fill="none">
            <g
              stroke="currentColor"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M36 82C88 38 168 38 220 82" strokeWidth="22" />
              <path d="M62 118C104 82 152 82 194 118" strokeWidth="22" />
              <path d="M90 150C114 130 142 130 166 150" strokeWidth="22" />
              <circle cx="128" cy="186" r="20" fill="currentColor" />
              <line x1="143" y1="201" x2="172" y2="230" />
            </g>
          </svg>
        </span>
        <span className="nav-bar-brand-copy">
          <span className="nav-bar-brand-name">Signal Eye</span>
          <span className="nav-bar-brand-tag">Trend intelligence terminal</span>
        </span>
      </Link>
      <div className="nav-bar-links">
        {NAV_LINKS.map((link) => {
          const active =
            link.href === "/explore"
              ? pathname === "/explore" || pathname.startsWith("/trends") || pathname.startsWith("/sources")
              : pathname.startsWith(link.href);
          return (
            <Link
              className={`nav-bar-link${active ? " nav-bar-link-active" : ""}`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
