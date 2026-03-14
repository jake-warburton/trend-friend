"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

const NAV_LINKS = [
  { label: "Explorer", href: "/" },
  { label: "Settings", href: "/settings" },
] as const;

export function NavBar() {
  const pathname = usePathname();
<<<<<<< HEAD
<<<<<<< Updated upstream
  const navClassName = pathname === "/" ? "nav-bar nav-bar-static" : "nav-bar";
=======
  const navClassName = pathname === "/" ? "nav-bar nav-bar-static nav-bar-blend" : "nav-bar";
  const { user, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Account";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
>>>>>>> Stashed changes
=======
  const navClassName = pathname === "/" ? "nav-bar nav-bar-static nav-bar-blend" : "nav-bar";
>>>>>>> main

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

        {!loading && !user && (
          <Link
            className={`nav-bar-link${pathname === "/login" ? " nav-bar-link-active" : ""}`}
            href="/login"
          >
            Sign in
          </Link>
        )}

        {!loading && user && (
          <div className="nav-bar-user" ref={menuRef}>
            <button
              className="nav-bar-avatar"
              onClick={() => setMenuOpen((prev) => !prev)}
              type="button"
              aria-label="Account menu"
            >
              {initials}
            </button>
            {menuOpen && (
              <div className="nav-bar-dropdown">
                <div className="nav-bar-dropdown-header">
                  <strong>{displayName}</strong>
                  {user.email && <span className="nav-bar-dropdown-email">{user.email}</span>}
                </div>
                <Link
                  className="nav-bar-dropdown-item"
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
                <Link
                  className="nav-bar-dropdown-item"
                  href="/billing"
                  onClick={() => setMenuOpen(false)}
                >
                  Billing
                </Link>
                <button
                  className="nav-bar-dropdown-item nav-bar-dropdown-signout"
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                  }}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
