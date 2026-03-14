"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";

const NAV_LINKS = [
  { label: "Explorer", href: "/" },
  { label: "Community", href: "/community" },
] as const;

export function NavBar() {
  const pathname = usePathname();
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
