import styles from './projectInvestment.module.css';

export type Milestone = {
  date: string | null;
  status: 'completed' | 'current' | 'planned' | 'unconfirmed';
};
export type ProjectMilestones = Record<'site' | 'permit' | 'construction' | 'completion', Milestone>;
const steps = [
  ['site', 'Site secured'],
  ['permit', 'Permit obtained'],
  ['construction', 'Construction started'],
  ['completion', 'Completion'],
] as const;
const statusLabels = { completed: 'Completed', current: 'In progress', planned: 'Expected', unconfirmed: 'To be confirmed' };

export default function ProjectTimeline({ milestones }: { milestones: ProjectMilestones }) {
  return <section className={styles.section} aria-label="Project timeline">
    <p className={styles.eyebrow}>PROJECT MILESTONES</p>
    <h2 className={styles.heading}>From location to completion.</h2>
    <ol className={styles.timeline}>
      {steps.map(([key, label], index) => {
        const milestone = milestones[key];
        return <li key={key} className={styles.milestone} data-status={milestone.status} aria-current={milestone.status === 'current' ? 'step' : undefined}>
          <span className={styles.marker} aria-hidden="true">{milestone.status === 'completed' ? '✓' : index + 1}</span>
          <p className={styles.date}>{milestone.date || 'Date to be confirmed'}</p>
          <h3>{label}</h3>
          <span className={styles.status}>{statusLabels[milestone.status]}</span>
        </li>;
      })}
    </ol>
    <p className={styles.note}>Expected dates reflect the current project schedule and may change.</p>
  </section>;
}
