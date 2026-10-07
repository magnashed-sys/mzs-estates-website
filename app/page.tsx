
import Link from "next/link";

export default function Home() {
  return (
    <main className="mzs-home">
      <header className="mzs-home-header">
        <Link href="/" className="mzs-wordmark">
          <span className="mzs-monogram">MZS</span>
          <span className="mzs-group-label">GROUP</span>
        </Link>

        <span className="mzs-private-label">
          Private Access
        </span>
      </header>

      <section className="mzs-hero">
        <p className="mzs-kicker">
          MZS GROUP
        </p>

        <h1>
          Private.
          <br />
          Independent.
          <br />
          International.
        </h1>

        <p className="mzs-intro">
          A private platform connecting selected clients
          and partners with opportunities across real estate,
          investment and capital.
        </p>

        <div className="mzs-actions">
          <Link
            href="/login?role=client"
            className="mzs-button"
          >
            Client Login
          </Link>

          <Link
            href="/login?role=partner"
            className="mzs-button"
          >
            Partner Login
          </Link>

          <Link
            href="/request-access"
            className="mzs-button mzs-button-subtle"
          >
            Request Access
          </Link>
        </div>

        <p className="mzs-selective">
          New relationships are considered on a selective basis.
        </p>
      </section>

      <footer className="mzs-home-footer">
        <span>
          Amsterdam · Ibiza · Mallorca · Madrid · Alicante ·
          Dubai · Abu Dhabi
        </span>

        <span>By invitation only.</span>
      </footer>
    </main>
  );
}
