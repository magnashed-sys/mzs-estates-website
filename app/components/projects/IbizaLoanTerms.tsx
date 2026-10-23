import {useTranslations} from "next-intl";
import styles from './projectInvestment.module.css';

// Owner-confirmed draft terms. Attach to a project only after its identity is confirmed.
export default function IbizaLoanTerms() {
  const t = useTranslations("ProjectUI");
  const terms = [
    [t("p440"), '€1,000,000'],
    [t("p441"), '10%'],
    [t("p442"), t("loanTerm")],
    [t("p443"), t("loanMinimum")],
  ];

  return <section className={styles.section} aria-label={t("p444")}>
    <p className={styles.eyebrow}>{t("p445")}</p>
    <h2 className={styles.heading}>{t("p446")}</h2>
    <p className={styles.introduction}>{t("p447")}</p>
    <dl className={styles.terms}>{terms.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <aside className={styles.valuation}><p className={styles.eyebrow}>{t("p448")}</p><p className={styles.valuationAmount}>€6,200,000</p><p>{t("p449")}</p></aside>
    <div className={styles.details}>
      <article><h3>{t("p450")}</h3><p>{t("p451")}</p></article>
      <article><h3>{t("p452")}</h3><p>{t("p453")}</p></article>
    </div>
    <p className={styles.note}>{t("p454")}</p>
  </section>;
}
