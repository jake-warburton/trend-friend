import type { Metadata } from "next";
import { NavBar } from "@/components/nav-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Eye",
  description: "Trend intelligence dashboard for emerging topics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className="theme-soft-charcoal" lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
