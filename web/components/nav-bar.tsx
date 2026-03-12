"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Explorer", href: "/" },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const navClassName = pathname === "/" ? "nav-bar nav-bar-static nav-bar-blend" : "nav-bar";

  return (
    <nav className={navClassName}>
      <Link className="nav-bar-brand" href="/">
        <span className="nav-bar-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 256 256" role="presentation" fill="none">
            <g
              stroke="#22c55e"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M40 96C90 56 166 56 216 96" />
              <path d="M68 128C106 98 150 98 188 128" />
              <path d="M96 160C116 144 140 144 160 160" />
              <circle cx="128" cy="186" r="18" />
              <line x1="141" y1="199" x2="167" y2="225" />
            </g>
          </svg>
        </span>
        <span className="nav-bar-brand-copy">
          <span className="nav-bar-brand-name">Signal Eye</span>
          <span className="nav-bar-brand-tag">Market intelligence terminal</span>
        </span>
      </Link>
      <div className="nav-bar-links">
        {NAV_LINKS.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/" || pathname.startsWith("/trends") || pathname.startsWith("/sources")
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
