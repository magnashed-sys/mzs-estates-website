// Room positions follow the owner's annotated plan and review of 31 October 2026.
// Door openings and furnishings are a visual interpretation of the property photos.
export const roomKey = [
  {label:"Slaapkamers", color:"#ddd2ec"},
  {label:"Badkamers", color:"#c8e2ec"},
  {label:"Toiletten", color:"#e5aaa0"},
  {label:"Keuken", color:"#d4e2c3"},
  {label:"Woon- en eetkamer", color:"#f1e1ad"},
];
export const interiorBadges: Record<string, {x:number;y:number}> = {
  "guest-white": {x:126,y:484}, "guest-green": {x:126,y:146}, living: {x:557,y:480},
};
export const interiorDescriptions: Record<string,string> = {
  "guest-white": "Slaapkamer aan de voorzijde met het hoofdeinde tegen de linkerwand; badkamer met toilet aan de achterzijde.",
  "guest-green": "Slaapkamer aan de achterzijde; badkamer met toilet en een schuifdeur in de wand aan de voorzijde.",
  living: "Twee slaapkamers links met deuren naast elkaar en bedden tegen de linker- en rechterwand, badkamer linksvoor, langwerpige keuken met toilet linksonder en een centrale terrasdeur. Rechts de zithoek aan de terraszijde, eettafel aan de voorzijde en dubbele terrasdeuren in het midden.",
};
const wall = "#858773";
const bedroom = roomKey[0].color, bathroom = roomKey[1].color;

function Bed({x,y,w=40,h=48}:{x:number;y:number;w?:number;h?:number}) {
  return <g transform={`translate(${x} ${y})`} stroke="#9482a3" strokeWidth="1.1">
    <rect x="-2" y="-3" width={w+4} height="6" rx="2" fill="#b9a7cb"/>
    <rect width={w} height={h} rx="3" fill="#faf7fc"/>
    <rect x="2" y="15" width={w-4} height={h-17} rx="2" fill="#c6b6db"/>
    <rect x="3" y="4" width={w/2-5} height="9" rx="2" fill="#fffdfd"/>
    <rect x={w/2+2} y="4" width={w/2-5} height="9" rx="2" fill="#fffdfd"/>
    <path d={`M2 ${h-10}H${w-2}`} fill="none" stroke="#ad97c4"/>
  </g>;
}
function Shower({x,y,w=28,h=28}:{x:number;y:number;w?:number;h?:number}) {
  return <g transform={`translate(${x} ${y})`} stroke="#6f9ca8" strokeWidth="1.1">
    <rect width={w} height={h} rx="2" fill="#eff8f9"/>
    <path d={`M3 3L${w-3} ${h-3}M${w-3} 3L3 ${h-3}`} stroke="#bddee3"/>
    <circle cx={w/2} cy={h/2} r="1.8" fill="#8aaeb8" stroke="none"/>
  </g>;
}
function Basin({x,y,w=28}:{x:number;y:number;w?:number}) {
  return <g transform={`translate(${x} ${y})`} stroke="#779ca5" strokeWidth="1">
    <rect width={w} height="12" rx="2" fill="#fcfdfb"/>
    <rect x="5" y="3" width={w-10} height="6" rx="3" fill="#d5e8ec"/>
    <path d={`M${w/2} 0V4`}/>
  </g>;
}
function Toilet({x,y}:{x:number;y:number}) {
  return <g transform={`translate(${x} ${y})`}>
    <rect x="-3" y="-3" width="24" height="31" rx="4" fill={roomKey[2].color}/>
    <g stroke="#ab7167" strokeWidth="1">
      <rect x="2" width="14" height="7" rx="2" fill="#fff8f2"/>
      <ellipse cx="9" cy="15" rx="7" ry="9" fill="#fff8f2"/>
      <ellipse cx="9" cy="15" rx="4" ry="5.5" fill="#f2d4cb"/>
    </g>
  </g>;
}
function Door({x,y,rotate=0,flip=false,size=22}:{x:number;y:number;rotate?:number;flip?:boolean;size?:number}) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(1 ${flip?-1:1})`} data-plan-door="true">
    <path d={`M0 0H${size}`} stroke="#f7f2e8" strokeWidth="5.5"/>
    <path d={`M0 0V${-size}`} stroke="#626858" strokeWidth="1.7"/>
    <path d={`M${size} 0A${size} ${size} 0 0 0 0 ${-size}`} fill="none" stroke="#8c917c" strokeWidth="1"/>
  </g>;
}
function PocketDoor({x,y,size=24}:{x:number;y:number;size?:number}) {
  return <g transform={`translate(${x} ${y})`} data-plan-pocket-door="true">
    <title>Schuifdeur die naar links in de wand verdwijnt</title>
    <path d={`M0 0H${size}`} stroke="#f7f2e8" strokeWidth="6"/>
    <rect x={-size-3} y="-3" width={size+3} height="6" fill="#f7f2e8" stroke={wall} strokeWidth="1"/>
    <path d={`M${-size} 0H-1M${size-2} -10H3L7 -14M3 -10L7 -6`} fill="none" stroke="#626858" strokeWidth="1.4"/>
  </g>;
}

export default function VillaInteriorPlan({zone}:{zone:string}) {
  if (zone === "guest-white") return <g>
    <title>Slaapkamer met badkamer en toilet · gastenverblijf voorkant</title>
    <rect x="112" y="352" width="146" height="48" fill={bathroom}/>
    <rect x="112" y="400" width="146" height="98" fill={bedroom}/>
    <path d="M110 400H260" stroke={wall} strokeWidth="2.5"/>
    <Shower x={121} y={359} w={34} h={32}/><Basin x={166} y={359} w={32}/><Toilet x={228} y={360}/>
    <g transform="translate(117 460) rotate(-90)">
      <Bed x={0} y={0} w={48} h={61}/>
      <rect x="-9" y="1" width="7" height="10" rx="1" fill="#baa9cc"/>
      <rect x="50" y="1" width="7" height="10" rx="1" fill="#baa9cc"/>
    </g>
    <Door x={178} y={400}/><Door x={220} y={500}/>
  </g>;
  if (zone === "guest-green") return <g>
    <title>Slaapkamer met badkamer en toilet · gastenverblijf achter</title>
    <rect x="112" y="132" width="126" height="98" fill={bedroom}/>
    <rect x="112" y="230" width="126" height="58" fill={bathroom}/>
    <path d="M110 230H240" stroke={wall} strokeWidth="2.5"/>
    <Bed x={151} y={152} w={48} h={59}/>
    <rect x="142" y="152" width="7" height="10" rx="1" fill="#baa9cc"/>
    <rect x="201" y="152" width="7" height="10" rx="1" fill="#baa9cc"/>
    <Toilet x={122} y={252}/><Basin x={158} y={271}/><Shower x={203} y={240} w={28} h={39}/>
    <PocketDoor x={178} y={230}/><Door x={240} y={197} rotate={90} flip/>
  </g>;
  if (zone === "laundry") return <g>
    <title>Waskamer met toegang vanaf het terras</title>
    <Door x={230} y={305} rotate={90} flip/>
  </g>;
  if (zone !== "living") return null;
  return <g>
    <title>Twee slaapkamers, badkamer, apart toilet, keuken, hal en woon- en eetkamer</title>
    <rect x="262" y="352" width="436" height="146" fill="#f5efe0"/>
    <rect x="262" y="352" width="98" height="73" fill={bedroom}/>
    <rect x="360" y="352" width="80" height="73" fill={bedroom}/>
    <rect x="262" y="425" width="80" height="73" fill={bathroom}/>
    <rect x="440" y="352" width="100" height="48" fill={roomKey[3].color}/>
    <rect x="440" y="385" width="37" height="40" fill="#f2d2ca"/>
    <rect x="540" y="352" width="158" height="146" fill={roomKey[4].color}/>
    <path d="M342 425V500M260 425H477M477 400H540M360 350V425M440 350V425M440 385H477V425M540 350V500" fill="none" stroke={wall} strokeWidth="2.5"/>
    <g transform="translate(267 402) rotate(-90)"><Bed x={0} y={0} w={38} h={45}/></g>
    <g transform="translate(433 363) rotate(90)"><Bed x={0} y={0} w={40} h={45}/></g>
    <Shower x={270} y={433} w={30} h={30}/><Basin x={275} y={480} w={34}/>
    <Toilet x={449} y={390}/>
    {/* Kitchen counters leave the central terrace doorway clear. */}
    <path d="M510 357H532V389H521V368H510Z" fill="#f9fbf3" stroke="#91a47b" strokeWidth="1.2"/>
    <rect x="447" y="357" width="23" height="11" rx="1" fill="#f9fbf3" stroke="#91a47b" strokeWidth="1.2"/>
    <rect x="523" y="373" width="7" height="12" rx="2" fill="#c9dfde" stroke="#91a47b"/>
    <rect x="515" y="358" width="15" height="9" rx="1" fill="#737d68"/>
    {[519,526].flatMap(x=>[361,364].map(y=><circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="#dde7d0"/>))}
    {/* Dining table at the front; seating area towards the pool terrace. */}
    <g fill="#c5b185" stroke="#a08b60" strokeWidth="1">
      {[592,613,634].map(x=><g key={x}><rect x={x} y="449" width="12" height="6" rx="1"/><rect x={x} y="484" width="12" height="6" rx="1"/></g>)}
      <rect x="587" y="458" width="63" height="23" rx="4" fill="#ddc899"/>
    </g>
    <path d="M671 363H688V431H607V416H671Z" fill="#fcf7e7" stroke="#ad9c79" strokeWidth="1.3"/>
    <path d="M675 366V419H610M674 383H688M674 400H688M635 419V431M655 419V431" fill="none" stroke="#d0c0a0"/>
    <rect x="629" y="378" width="26" height="25" rx="3" fill="#c9b07c" stroke="#a08b60"/>
    <rect x="545" y="381" width="5" height="27" rx="1" fill="#6c705f"/>
    <Door x={356} y={425} rotate={180} flip/><Door x={342} y={455} rotate={90} flip/>
    <Door x={364} y={425}/><Door x={449} y={425} size={20} flip/>
    {/* Open internal kitchen access; centered exterior door opens onto the terrace. */}
    <path d="M490 400H514" stroke="#f5efe0" strokeWidth="5.5"/>
    <path d="M490 397V403M514 397V403" stroke={wall} strokeWidth="1.5"/>
    <Door x={478} y={350} size={24} flip/>
    <Door x={598} y={350} size={22} flip/><Door x={642} y={350} size={22} rotate={180}/>
    <Door x={496} y={500} size={14}/><Door x={524} y={500} size={14} rotate={180} flip/>
    {/* Open archway from the entrance hall to the living room. */}
    <path d="M540 447V477" stroke="#f5efe0" strokeWidth="5.5"/>
    <path d="M537 447H543M537 477H543" stroke={wall} strokeWidth="1.5"/>
  </g>;
}
