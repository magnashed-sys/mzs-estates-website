import {contentBlocks} from '../../lib/insights/model';
export default function Content({body}:{body:string}) {
 return <>{contentBlocks(body).map((block,i)=>block.type==='h2'?<h2 key={i}>{block.text}</h2>:block.type==='h3'?<h3 key={i}>{block.text}</h3>:block.type==='list'?<ul key={i}>{block.items?.map((item,j)=><li key={j}>{item}</li>)}</ul>:<p key={i}>{block.text}</p>)}</>;
}
