import Image from 'next/image';
import {insightImage} from '../../lib/insights/images';
import s from './insights.module.css';
export default function Cover({src,alt,card=false,priority=false,caption}:{src?:string;alt?:string;card?:boolean;priority?:boolean;caption?:string}){
 const image=insightImage(src);if(!image)return null;
 const photo=<Image src={image.src} alt={alt||''} width={image.width} height={image.height} style={card?undefined:{aspectRatio:`${image.width}/${image.height}`}}
  sizes={card?'(max-width: 600px) 90vw, (max-width: 900px) 45vw, 340px':'(max-width: 850px) 90vw, 780px'} priority={priority}/>;
 if(card)return <div className={s.cardImage}>{photo}</div>;
 return <figure className={s.cover} style={caption?{background:'transparent'}:undefined}>{photo}{caption&&<figcaption style={{fontSize:'.8rem',lineHeight:1.6,color:'#58614f',paddingTop:10}}>{caption}</figcaption>}</figure>;
}
