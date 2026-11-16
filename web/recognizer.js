export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function angle(a,b,c){const u={x:a.x-b.x,y:a.y-b.y},v={x:c.x-b.x,y:c.y-b.y};return Math.acos(Math.max(-1,Math.min(1,(u.x*v.x+u.y*v.y)/(Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y)||1))))*180/Math.PI;}
export function evaluate(h,w,height,g){
 if(!h||h.length!==21||h.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return {valid:false,usable:false,message:'No se detectan las manos'};
 const p=h.map(v=>({x:v.x*w,y:v.y*height})); const palm=distance(p[0],p[9]);
 if(h.some(v=>v.x<.025||v.x>.975||v.y<.025||v.y>.975))return {valid:false,usable:false,message:'Coloca toda la mano dentro del encuadre'};
 if(palm<g.minPalmPixels)return {valid:false,usable:false,message:'Acerca un poco la mano a la cámara'};
 const aspect=distance(p[5],p[17])/palm;
 if(aspect<g.minPalmAspect)return {valid:false,usable:false,message:'Orienta la palma hacia la cámara'};
 const angles=[5,9,13,17].map(i=>angle(p[i],p[i+1],p[i+2]));
 const dips=[5,9].map(i=>angle(p[i+1],p[i+2],p[i+3]));
 const separation=distance(p[8],p[12])/palm;
 const extended=angles[0]>g.extendedAngle&&angles[1]>g.extendedAngle&&dips.every(a=>a>g.extendedAngle);
 const folded=angles[2]<g.foldedAngle&&angles[3]<g.foldedAngle;
 const spaced=separation>g.minSeparation&&separation<g.maxSeparation;
 let message=!extended?'Extiende índice y corazón':!folded?'Flexiona anular y meñique':!spaced?'Ajusta la separación de los dos dedos':'Mantén el gesto';
 return {valid:extended&&folded&&spaced,usable:true,message,angles,dips,separation,palmPixels:palm,aspect};
}
export class GestureGate{
 constructor(c){this.c=c;this.reset();}
 reset(){this.state='ready';this.progress=0;this.last=null;this.lastValid=null;this.release=0;this.until=0;}
 update(t,r){
 const dt=this.last===null?0:Math.min(100,Math.max(0,t-this.last));this.last=t;
 if(this.lastValid!==null&&t-this.lastValid>this.c.lostGraceMs&&this.state==='ready')this.progress=0;
 if(this.state==='cooldown'){
  if(t<this.until)return {state:'cooldown',progress:0,fire:false,message:'Técnica activada · recuperación'};
  this.state='release';
 }
 if(this.state==='release'){
  this.release=r.usable&&!r.valid?this.release+dt:0;
  if(this.release>=this.c.releaseMs){this.state='ready';this.progress=0;this.lastValid=null;this.release=0;return {state:'ready',progress:0,fire:false,message:'Técnica preparada'};}
  return {state:'release',progress:0,fire:false,message:'Abre la mano para volver a preparar'};
 }
 if(r.valid){this.lastValid=t;this.progress+=dt;}
 else if(r.usable){this.progress=0;this.lastValid=null;}
 if(this.progress>=this.c.holdMs){this.state='cooldown';this.until=t+this.c.cooldownMs;this.progress=0;return {state:'cooldown',progress:1,fire:true,message:'¡Azul!'};}
 return {state:r.valid?'holding':this.progress?'paused':'ready',progress:this.progress/this.c.holdMs,fire:false,message:r.message};
 }
}
