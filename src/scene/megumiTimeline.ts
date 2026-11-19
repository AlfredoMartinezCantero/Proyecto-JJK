export const MEGUMI_CONTACT = {
  'divine-dogs':1350, nue:1600, totality:1850, toad:1250,
  'max-elephant':2150, 'rabbit-escape':1100, mahoraga:3300, 'chimera-garden':2600,
} as const;
export type MegumiTechniqueKey = keyof typeof MEGUMI_CONTACT;
export type ExpandedShadowKey = Exclude<MegumiTechniqueKey,'divine-dogs'|'nue'>;
export const DOG_SECOND_HIT_MS = 400;
export const TOTALITY_SECOND_HIT_MS = 350;
export const isMegumiTechnique = (key:string):key is MegumiTechniqueKey => Object.hasOwn(MEGUMI_CONTACT,key);
export const isExpandedShadowTechnique = (key:string):key is ExpandedShadowKey => isMegumiTechnique(key)&&key!=='divine-dogs'&&key!=='nue';
const EVENTS: Record<MegumiTechniqueKey,readonly number[]> = {
  'divine-dogs':[1350,1750],nue:[1600],totality:[1850,2200],toad:[1250],
  'max-elephant':[2150],'rabbit-escape':[1100],mahoraga:[3300],'chimera-garden':[2600,3400,4200,5000,5800],
};
export const megumiContactTimes = (key:MegumiTechniqueKey):readonly number[] => EVENTS[key];
const smooth=(value:number)=>{const t=Math.min(1,Math.max(0,value));return t*t*(3-2*t);};
export function megumiTimeline(key:MegumiTechniqueKey,elapsed:number,duration:number){
  const active=Number.isFinite(elapsed)&&elapsed>=0&&elapsed<duration,age=elapsed-MEGUMI_CONTACT[key];
  let last=-1;for(const event of EVENTS[key])if(elapsed>=event)last=event;
  const hitAge=last<0?-1:elapsed-last;
  const second=(key==='divine-dogs'&&age>=DOG_SECOND_HIT_MS)||(key==='totality'&&age>=TOTALITY_SECOND_HIT_MS);
  const collapse=active&&(key==='nue'||key==='toad'||key==='max-elephant')
    ?smooth((age-(key==='toad'?1700:600))/650):0;
  return {active,age,hitAge,second,
    emerge:active?smooth(elapsed/(key==='mahoraga'?1500:650)):0,
    retire:active?smooth((elapsed-(key==='divine-dogs'||key==='nue'?3000:duration-1300))/1100):1,
    pulse:active&&hitAge>=0?Math.exp(-hitAge/160):0,
    shock:active&&key==='nue'&&age>=0?1-smooth(age/950):0,
    collapse,
    bind:active&&key==='toad'?smooth(age/150)*(1-smooth((age-1450)/350)):0,
    drag:active&&key==='toad'?smooth((age-250)/1050):0,
    flood:active&&key==='max-elephant'?smooth(age/180)*(1-smooth((age-1800)/600)):0,
    distract:active&&key==='rabbit-escape'?smooth(age/250)*(1-smooth((age-1700)/700)):0,
    engulf:active&&key==='chimera-garden'?smooth((elapsed-2900)/3500):0,
  };
}
