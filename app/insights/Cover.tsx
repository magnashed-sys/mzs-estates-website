import Image from 'next/image';
import {insightImage} from '../../lib/insights/images';
import s from './insights.module.css';
export default function Cover({src,alt,card=false,priority=false}:{src?:string;alt?:string;card?:boolean;priority?:boolean}){
 const image=insightImage(src);if(!image)return null;
 return <div className={card?s.cardImage:s.cover}><Image src={image.src} alt={alt||''} width={1672} height={941}
  sizes={card?'(max-width: 600px) 90vw, (max-width: 900px) 45vw, 340px':'(max-width: 850px) 90vw, 780px'} priority={priority}/></div>;
}
