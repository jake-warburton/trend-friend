import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { NavBar } from "@/components/nav-bar";
import { getThemeClass, LIGHT_THEME, readThemePreference, THEME_COOKIE } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Eye",
  description: "Trend intelligence dashboard for emerging topics.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let themeKey = LIGHT_THEME;
  try {
    const cookieStore = await cookies();
    themeKey = readThemePreference(cookieStore.get(THEME_COOKIE)?.value) ?? LIGHT_THEME;
  } catch {
    themeKey = LIGHT_THEME;
  }
  const themeClass = getThemeClass(themeKey);
  const themeBootstrap = `
    (function () {
      try {
        var themeCookie = document.cookie
          .split('; ')
          .find(function (entry) { return entry.indexOf('${THEME_COOKIE}=') === 0; });
        var themeValue = themeCookie ? decodeURIComponent(themeCookie.split('=').slice(1).join('=')) : '';
        var themeClassName = themeValue === 'soft-charcoal'
          ? 'theme-soft-charcoal'
          : themeValue === 'ocean'
            ? 'theme-ocean'
            : themeValue === 'atlassian-light'
              ? 'theme-atlassian-light'
              : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'theme-soft-charcoal' : 'theme-atlassian-light');
        document.documentElement.classList.remove('theme-atlassian-light', 'theme-soft-charcoal', 'theme-ocean');
        document.documentElement.classList.add(themeClassName);
      } catch (error) {}
    }());
  `;

  return (
    <html className={themeClass} lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <NavBar />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
