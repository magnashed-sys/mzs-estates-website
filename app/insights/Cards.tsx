import Link from 'next/link';
import {insightPath,type Insight} from '../../lib/insights/model';
import s from './insights.module.css';
export default function Cards({items,labels}:{items:Insight[];labels:Record<string,string>}) {
 return <div className={s.grid}>{items.map(item=><article className={s.card} key={item.id}>
  <p className={s.eyebrow}>{labels[item.category]}{item.region && <> · {item.region}</>}</p>
  <h2><Link href={insightPath(item.locale,item.slug)} prefetch={false}>{item.title}</Link></h2>
  <p>{item.summary}</p><div className={s.cardFoot}><span>{item.author}</span><span aria-hidden="true">↗</span></div>
 </article>)}</div>;
}
