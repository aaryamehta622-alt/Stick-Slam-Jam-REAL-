import type { ClassDef } from '@/game/classes';
export function FighterPortrait({fighter}:{fighter:ClassDef}){
  const blade=['katana','gladius','twinDaggers','kunai','shadowBlade'].includes(fighter.weapon??'');
  const masked=['ninja','assassin','shadowRogue','shadowAssassin','executioner'].includes(fighter.id);
  return <svg viewBox="0 0 48 56" width="47" height="53" aria-hidden="true" className="fighter-portrait" shapeRendering="crispEdges" style={{color:fighter.color}}>
    <path d="M6 52H42V54H6Z" fill="currentColor" opacity=".2"/>
    <g stroke="#10131b" strokeWidth="6" strokeLinejoin="miter" fill="none"><path d="M23 20V36L14 50M23 36L32 50M23 25L13 32L10 25M23 25L33 32L39 25"/></g>
    <g stroke="currentColor" strokeWidth="4" strokeLinejoin="miter" fill="none"><path d="M23 20V36L14 50M23 36L32 50M23 25L13 32L10 25M23 25L33 32L39 25"/></g>
    <path d="M18 6H28V8H30V17H28V20H18V18H16V8H18Z" fill="currentColor" stroke="#11131b" strokeWidth="1"/>
    <path d="M19 8H23V10H19Z" fill="#fff" opacity=".35"/><path d="M25 11H28V13H25Z" fill="#151723"/>
    {fighter.id==='fisherman'&&<path d="M13 8H33V11H13ZM18 3H28V8H18Z" fill="#d4bc7b"/>}
    {masked&&<path d="M17 14H29V18H17ZM9 18H18V21H9V19H6V17H9Z" fill="#22202c"/>}
    {fighter.id==='samurai'&&<path d="M16 8H30V11H16ZM10 10H17V12H10Z" fill="#2b2535"/>}
    {fighter.id==='viking'&&<path d="M17 8H29V11H17ZM17 8H12V3H10V9H15V12H17ZM29 8H34V3H36V9H31V12H29Z" fill="#dfd1ac"/>}
    {['mage','stormMage'].includes(fighter.id)&&<path d="M15 8H31V11H15ZM18 8V4H21V0H24V4H27V8Z" fill="#51476f"/>}
    {fighter.id==='fisherman'?<g fill="none" stroke="#d4bc7b" strokeWidth="2"><path d="M38 29Q38 5 45 2"/><path d="M45 2V39L43 42" stroke="#90e5e7" strokeWidth=".6"/></g>:blade?<g stroke="#ede6ce" strokeWidth="2"><path d="M39 25L46 9M36 24L42 27"/></g>:fighter.weapon==='rifle'||fighter.weapon==='cannon'?<g><path d="M33 24H47V28H33ZM41 21H46V24H41Z" fill="#c1bca6"/><path d="M35 28H39V33H35Z" fill="#78655a"/></g>:fighter.category==='heavy'?<g><path d="M38 26L41 5" stroke="#9b795b" strokeWidth="3"/><path d="M39 7H47V15H40Z" fill="#c1bca6"/></g>:fighter.category==='ranged'?<path d="M40 9H43V13H45V31H43V35H40M40 9V35M36 23H47" stroke="#c2a278" strokeWidth="1" fill="none"/>:fighter.category==='mage'?<g><path d="M39 22V10H45V16H39Z" fill="currentColor" opacity=".6"/><path d="M41 10H45V14H41Z" fill="#ede9d4"/></g>:<path d="M35 24H41V29H35Z" fill={fighter.id==='boxer'?'#df5b55':'currentColor'}/>}
  </svg>;
}