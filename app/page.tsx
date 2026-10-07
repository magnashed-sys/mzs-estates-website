import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      <div className="brand">MZS GROUP</div>

      <section className="hero">
        <p className="eyebrow">Private Access</p>

        <h1>
          Private.
          <br />
          Independent.
          <br />
          International.
        </h1>

        <div className="actions">
          <Link href="/login?role=client">Client Login</Link>
          <Link href="/login?role=partner">Partner Login</Link>
        </div>
      </section>

      <footer>
        <span>By invitation only.</span>
      </footer>
    </main>
  );
}
