import styles from './projectInvestment.module.css';

// Owner-confirmed draft terms. Attach to a project only after its identity is confirmed.
const terms = [
  ['Current financing requirement', '€1,000,000'],
  ['Annual interest rate', '10%'],
  ['Initial term', '12 months'],
  ['Minimum participation', '€1,000,000 · one lender'],
];
export default function IbizaLoanTerms() {
  return <section className={styles.section} aria-label="Proposed loan terms">
    <p className={styles.eyebrow}>PRIVATE FINANCING / IBIZA</p>
    <h2 className={styles.heading}>A defined lending opportunity.</h2>
    <p className={styles.introduction}>An initial €1 million loan to support the property project, with a proposed annual interest rate of 10%.</p>
    <dl className={styles.terms}>{terms.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <aside className={styles.valuation}><p className={styles.eyebrow}>VALUATION UPON COMPLETION</p><p className={styles.valuationAmount}>€6,200,000</p><p>Appraised value after renovation: €6,200,000. Valuation report available on request.</p></aside>
    <div className={styles.details}>
      <article><h3>Optional follow-on financing</h3><p>If the property remains unsold after 12 months, a further €1 million loan may be agreed separately. The initial lender has no advance obligation to provide this additional financing. An extension of the initial loan is also subject to agreement.</p></article>
      <article><h3>Personal security</h3><p>Personal security is proposed from the borrowers. Its precise form, scope and enforceability will be set out in the loan documentation.</p></article>
    </div>
    <p className={styles.note}>Proposed terms, subject to final agreement. Interest payment dates, early repayment provisions and the terms of any follow-on financing remain to be agreed. Expected project completion is separate from the initial loan maturity.</p>
  </section>;
}
