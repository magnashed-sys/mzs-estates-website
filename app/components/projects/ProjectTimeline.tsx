import {useTranslations} from "next-intl";
import styles from './projectInvestment.module.css';

export type Milestone = {
  date: string | null;
  status: 'completed' | 'current' | 'planned' | 'unconfirmed';
};
export type ProjectMilestones = Record<'site' | 'permit' | 'construction' | 'completion', Milestone>;
export default function ProjectTimeline({ milestones }: { milestones: ProjectMilestones }) {
  const t = useTranslations("ProjectUI");
  const steps = [
    ['site', t("p427")],
    ['permit', t("p428")],
    ['construction', t("p429")],
    ['completion', t("p430")],
  ] as const;
  const statusLabels = { completed: t("p431"), current: t("p432"), planned: t("p433"), unconfirmed: t("p434") };


  return <section className={styles.section} aria-label={t("p435")}>
    <p className={styles.eyebrow}>{t("p436")}</p>
    <h2 className={styles.heading}>{t("p437")}</h2>
    <ol className={styles.timeline}>
      {steps.map(([key, label], index) => {
        const milestone = milestones[key];
        return <li key={key} className={styles.milestone} data-status={milestone.status} aria-current={milestone.status === 'current' ? 'step' : undefined}>
          <span className={styles.marker} aria-hidden="true">{milestone.status === 'completed' ? '✓' : index + 1}</span>
          <p className={styles.date}>{milestone.date || t("p438")}</p>
          <h3>{label}</h3>
          <span className={styles.status}>{statusLabels[milestone.status]}</span>
        </li>;
      })}
    </ol>
    <p className={styles.note}>{t("p439")}</p>
  </section>;
}
