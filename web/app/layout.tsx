import type { Metadata } from "next";
import { NavBar } from "@/components/nav-bar";
<<<<<<< Updated upstream
=======
import { AuthProvider } from "@/components/auth-provider";
import { getThemeClass, LIGHT_THEME, readThemePreference, THEME_COOKIE } from "@/lib/settings";
>>>>>>> Stashed changes
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Eye",
  description: "Trend intelligence dashboard for emerging topics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className="theme-soft-charcoal" lang="en">
      <body>
<<<<<<< Updated upstream
        <NavBar />
        {children}
=======
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <AuthProvider>
          <NavBar />
          {children}
        </AuthProvider>
        <Analytics />
>>>>>>> Stashed changes
      </body>
    </html>
  );
}
