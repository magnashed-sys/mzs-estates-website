"use client";

import Link from "next/link";

export default function PrivatePage() {
  return (
    <main className="private-page">
      <header className="private-header">
        <Link href="/" className="private-brand">
          MZS GROUP
        </Link>

        <span>Private Access</span>
      </header>

      <section className="private-content">
        <p className="eyebrow">Selected for you</p>

        <h1>Your private opportunities.</h1>

        <p className="private-intro">
          A curated selection of opportunities available exclusively
          through MZS Group.
        </p>

        <div className="opportunity-card">
          <div>
            <p className="opportunity-location">
              Amsterdam · The Netherlands
            </p>

            <h2>Amsterdam Floraweg</h2>

            <div className="offering-tags">
              <span>Investment Opportunity</span>
            </div>
          </div>

          <span className="opportunity-link">
            View opportunity →
          </span>
        </div>
      </section>

      <footer className="private-footer">
        Private. Independent. International.
      </footer>
    </main>
  );
}
