import styles from "./ArrowUpRightIcon.module.css";

/** Decorative link arrow, independent of the device's text/emoji font. */
export default function ArrowUpRightIcon() {
  return (
    <svg
      className={styles.icon}
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 14 14 2M4 2h10v10" />
    </svg>
  );
}
