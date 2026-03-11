"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Explorer", href: "/" },
  { label: "Community", href: "/community" },
] as const;

export function NavBar() {
  const pathname = usePathname();
  const navClassName = pathname === "/" ? "nav-bar nav-bar-static" : "nav-bar";

  return (
    <nav className={navClassName}>
      <Link className="nav-bar-brand" href="/">
        <span className="nav-bar-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="presentation">
            <path
              d="M2.5 12C4.9 7.8 8.2 5.7 12 5.7S19.1 7.8 21.5 12c-2.4 4.2-5.7 6.3-9.5 6.3S4.9 16.2 2.5 12Z"
              fill="#f5f5f5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="12" cy="12" r="3.2" fill="#0b0b0b" />
            <circle cx="13.2" cy="10.8" r="0.95" fill="#f5f5f5" />
          </svg>
        </span>
        <span>Signal Eye</span>
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
