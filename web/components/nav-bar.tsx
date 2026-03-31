"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useProfile } from "@/components/profile-provider";

const NAV_LINKS = [
  { label: "Explorer", href: "/explore", pro: false, desktopOnly: false },
  { label: "AI Use Cases", href: "/ai-use-cases", pro: true, desktopOnly: false },
  { label: "Social Intelligence", href: "/social-intelligence", pro: true, desktopOnly: false },
  { label: "Ad Intelligence", href: "/ad-intelligence", pro: true, desktopOnly: false },
  { label: "Settings", href: "/settings", pro: false, desktopOnly: false },
] as const;

function AvatarContent({ user }: { user: { user_metadata?: Record<string, string>; email?: string } }) {
  if (user.user_metadata?.avatar_url) {
    return (
      <img
        src={user.user_metadata.avatar_url}
        alt=""
        className="nav-bar-avatar-img"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span className="nav-bar-avatar-initial">
      {(user.user_metadata?.full_name || user.email || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const { authEnabled, user } = useAuth();
  const { isPro } = useProfile();
  const [menuOpenPathname, setMenuOpenPathname] = useState<string | null>(null);
  const menuOpen = menuOpenPathname === pathname;
  const navClassName =
    pathname === "/explore" ? "nav-bar nav-bar-static nav-bar-blend" : "nav-bar";

  const closeMenu = useCallback(() => setMenuOpenPathname(null), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, closeMenu]);

  return (
    <>
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
        {NAV_LINKS.map((link) =>
          link.href === "/settings" ? null : (
            <NavLink
              key={link.href}
              link={link}
              pathname={pathname}
              isPro={isPro}
            />
          ),
        )}
        {user ? (
          <Link href="/settings" className="nav-bar-avatar" title={user.user_metadata?.full_name || user.email || "Account"}>
            <AvatarContent user={user} />
          </Link>
        ) : authEnabled ? (
          <Link href="/login" className="nav-bar-sign-in">
            Sign in
          </Link>
        ) : null}
      </div>

      <button
        className={`nav-bar-hamburger${menuOpen ? " nav-bar-hamburger-open" : ""}`}
        onClick={() => setMenuOpenPathname((prev) => (prev === pathname ? null : pathname))}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        <span className="nav-bar-hamburger-line" />
        <span className="nav-bar-hamburger-line" />
        <span className="nav-bar-hamburger-line" />
      </button>
    </nav>

    {menuOpen && (
      <div
        className="nav-bar-backdrop"
        onClick={closeMenu}
        aria-hidden="true"
      />
    )}

    <div
      className={`nav-bar-mobile-menu${menuOpen ? " nav-bar-mobile-menu-open" : ""}`}
    >
      <div className="nav-bar-mobile-header">
        {user ? (
          <Link href="/settings" className="nav-bar-avatar" onClick={closeMenu} title={user.user_metadata?.full_name || user.email || "Account"}>
            <AvatarContent user={user} />
          </Link>
        ) : authEnabled ? (
          <Link href="/login" className="nav-bar-sign-in" onClick={closeMenu}>
            Sign in
          </Link>
        ) : null}
        <button
          className="nav-bar-mobile-close"
          onClick={closeMenu}
          aria-label="Close menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.href}
          link={link}
          pathname={pathname}
          isPro={isPro}
          mobile
          onClick={closeMenu}
        />
      ))}
    </div>
    </>
  );
}

function NavLink({
  link,
  pathname,
  isPro,
  mobile,
  onClick,
}: {
  link: (typeof NAV_LINKS)[number];
  pathname: string;
  isPro: boolean;
  mobile?: boolean;
  onClick?: () => void;
}) {
  const active =
    link.href === "/explore"
      ? pathname === "/explore" ||
        pathname.startsWith("/trends") ||
        pathname.startsWith("/sources")
      : pathname.startsWith(link.href);

  const baseClass = mobile ? "nav-bar-mobile-link" : "nav-bar-link";
  const activeClass = mobile
    ? "nav-bar-mobile-link-active"
    : "nav-bar-link-active";

  return (
    <Link
      className={`${baseClass}${active ? ` ${activeClass}` : ""}`}
      href={link.href}
      onClick={onClick}
    >
      {link.label}
      {link.pro && !isPro && <span className="nav-bar-pro-badge">PRO</span>}
    </Link>
  );
}
