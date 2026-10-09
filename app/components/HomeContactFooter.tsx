import styles from "./HomeContactFooter.module.css";

// Prepared component only: do not wire into app/page.tsx until the homepage
// source and the public contact email have been confirmed. No default address.
type Props = { email: string };

export default function HomeContactFooter({ email }: Props) {
  const address = email.trim();
  if (!/^[^\s@?:]+@[^\s@?:]+\.[^\s@?:]+$/.test(address)) {
    throw new Error("Configure the confirmed public MZS contact email.");
  }
  return (
    <footer className={styles.footer}>
      <span className={styles.locations}>AMSTERDAM · IBIZA · DUBAI - INTERNATIONAL</span>
      <a className={styles.contact} href={`mailto:${address}`} aria-label={`Contact MZS Group by email: ${address}`}>
        <span>Contact MZS</span><span aria-hidden="true">↗</span>
      </a>
      <span className={styles.invitation}>BY INVITATION ONLY</span>
    </footer>
  );
}
