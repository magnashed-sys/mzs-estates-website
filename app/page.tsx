import Link from "next/link";
import HomeContactFooter from "./components/HomeContactFooter";
import polish from "./homepage-polish.module.css";
import "./homepage-refinements.css";

export default function Home() {
  return (
    <main className={`mzs-home mzs-home-image mzs-home-refined ${polish.home}`}>
      <header className="mzs-home-header">
        <Link href="/" className="mzs-wordmark" aria-label="MZS Group — Home">
          <span className="mzs-monogram">MZS</span>
          <span className="mzs-group-label">GROUP</span>
        </Link>
        <span className="mzs-private-label">Private Access</span>
      </header>

      <section className="mzs-hero">
        <h1>
          Private.
          <br />
          Independent.
          <br />
          International.
        </h1>

        <div className="mzs-separator" aria-hidden="true" />

        <p className="mzs-intro">
          MZS Group is an independent international real estate and investment
          group, providing selected clients and partners with access to private
          opportunities across Europe and the UAE.
        </p>

        <div className="mzs-actions">
          <Link href="/login?role=client" className="mzs-button">
            Client Login
          </Link>
          <Link href="/login?role=partner" className="mzs-button">
            Partner Login
          </Link>
          <Link href="/request-access" className="mzs-button mzs-button-subtle">
            Request Access →
          </Link>
        </div>

        <p className="mzs-selective">
          New relationships are considered on a selective basis.
        </p>
      </section>

      <HomeContactFooter email="info@mzsgroup.eu" />
    </main>
  );
}
