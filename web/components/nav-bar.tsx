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
        Trend Friend
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
