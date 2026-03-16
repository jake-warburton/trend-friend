import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link href="/" className="site-footer-logo">
            Signal Eye
          </Link>
          <p className="site-footer-tagline">
            Trend intelligence from 24+ data sources.
          </p>
        </div>

        <nav className="site-footer-links">
          <div className="site-footer-col">
            <h4>Product</h4>
            <Link href="/explore">Explorer</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/billing">Billing</Link>
          </div>
          <div className="site-footer-col">
            <h4>Account</h4>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Sign up</Link>
            <Link href="/settings">Settings</Link>
          </div>
          <div className="site-footer-col">
            <h4>Connect</h4>
            <a
              href="https://x.com/SignalEye"
              target="_blank"
              rel="noopener noreferrer"
            >
              X / Twitter
            </a>
          </div>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <span>&copy; {year} Signal Eye</span>
        <span className="site-footer-separator" aria-hidden="true">&middot;</span>
        <span>All rights reserved</span>
      </div>
    </footer>
  );
}
