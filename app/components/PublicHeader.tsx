import Link from "next/link";
import styles from "./PublicHeader.module.css";

/** Shared brand header for the four public entry pages. */
export default function PublicHeader() {
  return (
    <header className={`${styles.header} mzs-home-header`}>
      <Link href="/" className={`${styles.wordmark} mzs-wordmark`} aria-label="MZS Group — Home">
        <span className={`${styles.monogram} mzs-monogram`}>MZS</span>
        <span className={`${styles.groupLabel} mzs-group-label`}>GROUP</span>
      </Link>
      <span className={`${styles.privateLabel} mzs-private-label`}>Private Access</span>
    </header>
  );
}
