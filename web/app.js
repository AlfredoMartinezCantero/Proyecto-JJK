import {evaluate,GestureGate} from './recognizer.js';
const $=id=>document.getElementById(id);let config=await(await fetch('/config.json')).json(),gate=new GestureGate(config.technique);
let stream,worker,ready=false,busy=false,running=false,session=0,lastFrame=-1,lastDispatch=0,stage='idle',countEnd=0,smooth=null,lastRaw=null,tracked=null,burst=0,debugBurst=false,clipURL=null,audioURL=null,audioContext,uploadedAudio;
const cam=$('camera'),canvas=$('effects'),ctx=canvas.getContext('2d');let latest={valid:false,usable:false,message:'No se detectan las manos'},latestGate={state:'ready',progress:0},fps=0;
function hint(t){$('hint').textContent=t;}function state(t){$('state').textContent=t;}
function resetPractice(){gate.reset();smooth=null;lastRaw=null;tracked=null;latest={valid:false,usable:false,message:'No se detectan las manos'};latestGate={state:'ready',progress:0};$('progress').value=0;$('percent').textContent='0%';}
function stop(){session++;running=false;stream?.getTracks().forEach(t=>t.stop());stream=null;cam.srcObject=null;worker?.terminate();worker=null;ready=false;busy=false;stage='idle';resetPractice();$('empty').hidden=false;$('countdown').hidden=true;$('reference').pause();$('reference').hidden=true;$('start').disabled=false;$('practice').disabled=true;$('stop').disabled=true;state('ESPERA');hint('Cámara apagada.');$('fps').textContent='CÁMARA INACTIVA';}
$('start').onclick=async()=>{const ticket=++session;$('start').disabled=true;hint('Solicitando cámara y preparando el seguimiento…');
 try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Abre la aplicación en HTTPS o localhost.');
 const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:960},height:{ideal:720},facingMode:'user'},audio:false});if(ticket!==session){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;cam.srcObject=stream;await cam.play();canvas.width=cam.videoWidth;canvas.height=cam.videoHeight;$('viewport').style.aspectRatio=`${canvas.width}/${canvas.height}`;
 $('empty').hidden=true;$('stop').disabled=false;running=true;stage='loading';worker=new Worker('/tracker.js',{type:'module'});
 worker.onerror=e=>{hint('No se pudo cargar el motor de seguimiento. Revisa conexión y compatibilidad.');state('ERROR');$('practice').disabled=true;};
 worker.onmessage=({data})=>{
 if(data.type==='ready'){ready=true;stage='guide';$('practice').disabled=false;state('PREPARACIÓN');hint('Motor listo. Revisa la guía y empieza la práctica.');}
 if(data.type==='error'){busy=false;ready=false;$('practice').disabled=true;hint('Error del seguimiento: '+data.message);state('ERROR');}
 if(data.type==='result'){
 busy=false;if(!running)return;const t=performance.now();const raw=data.hands[0];
 if(raw){const jump=lastRaw&&Math.hypot(raw[0].x-lastRaw[0].x,raw[0].y-lastRaw[0].y)>.25;if(jump){smooth=null;gate.progress=0;gate.lastValid=null;}
 smooth=raw.map((p,i)=>smooth?{x:smooth[i].x*.4+p.x*.6,y:smooth[i].y*.4+p.y*.6,z:p.z}:p);tracked=smooth;lastRaw=raw;
 // Evaluate raw AND smoothed: smoothing must not prolong an old valid pose.
 const a=evaluate(raw,canvas.width,canvas.height,config.technique.gesture),b=evaluate(smooth,canvas.width,canvas.height,config.technique.gesture);latest={...b,valid:a.valid&&b.valid,usable:a.usable&&b.usable,message:a.valid?b.message:a.message};
 }else{tracked=null;smooth=null;lastRaw=null;latest={valid:false,usable:false,message:'No se detectan las manos'};}
 if(stage==='practice'){
 latestGate=gate.update(t,latest);hint(latestGate.message);state(({holding:'RECONOCIMIENTO',paused:'SEGUIMIENTO PERDIDO',cooldown:'ACTIVACIÓN',release:'REARMADO',ready:'PREPARACIÓN'})[latestGate.state]);
 $('progress').value=latestGate.progress;$('percent').textContent=Math.round(latestGate.progress*100)+'%';if(latestGate.fire)activate(false);
 }
 if($('debug').checked)$('metrics').textContent=JSON.stringify({stage,recognition:latest,gate:latestGate,model:'MediaPipe Hand Landmarker / CPU Worker',inferenceFPS:fps.toFixed(1)},null,2);
 }
 };
 worker.postMessage({type:'init'});
 }catch(e){stop();hint(e.name==='NotAllowedError'?'Permiso de cámara denegado. Puedes habilitarlo en el navegador.':e.name==='NotFoundError'?'No se encuentra una webcam.':e.message);state('ERROR');}
};
$('stop').onclick=stop;
$('practice').onclick=()=>{if(!ready)return;$('reference').pause();$('reference').hidden=true;resetPractice();stage='countdown';countEnd=performance.now()+3000;$('countdown').hidden=false;hint('Coloca la mano completa frente a la cámara.');};
$('replay').onclick=()=>{if(!clipURL)return;stage='reference';resetPractice();$('reference').hidden=false;$('reference').currentTime=0;$('reference').play().catch(()=>hint('Pulsa reproducir en el vídeo.'));};
$('reference').onended=()=>{ $('reference').hidden=true;if(ready)$('practice').click();else hint('Referencia terminada. Activa la cámara para practicar.');};
$('reference').onerror=()=>{hint('No se puede reproducir este formato. Prueba MP4 H.264 o continúa con la guía.');$('reference').hidden=true;stage=ready?'guide':'idle';};
$('videoFile').onchange=e=>{const file=e.target.files[0];if(!file)return;if(clipURL)URL.revokeObjectURL(clipURL);clipURL=URL.createObjectURL(file);$('reference').src=clipURL;$('replay').disabled=false;$('resourceStatus').textContent='Vídeo de sesión: '+file.name;config.technique.video={source:'local-session',name:file.name};$('replay').click();};
$('audioFile').onchange=e=>{const f=e.target.files[0];if(!f)return;if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(f);uploadedAudio=new Audio(audioURL);config.technique.audio={source:'local-session',name:f.name};$('resourceStatus').textContent='Audio de sesión: '+f.name;};
function sound(){const volume=+$('volume').value;if(!volume)return;if(uploadedAudio){uploadedAudio.volume=volume;uploadedAudio.currentTime=0;uploadedAudio.play().catch(()=>hint('Audio no reproducible. La técnica visual sigue funcionando.'));return;}
 try{audioContext??=new AudioContext();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime;o.type='sine';o.frequency.setValueAtTime(170,t);o.frequency.exponentialRampToValueAtTime(45,t+.65);g.gain.setValueAtTime(volume*.3,t);g.gain.exponentialRampToValueAtTime(.001,t+.7);o.connect(g).connect(audioContext.destination);o.start();o.stop(t+.7);}catch{}}
function activate(debug){burst=performance.now();debugBurst=debug;sound();if(debug)hint('Prueba de efectos · no es una detección de gesto');}
$('debug').onchange=()=>{$('debugPanel').hidden=!$('debug').checked;};$('testEffect').onclick=()=>activate(true);
$('hold').onchange=()=>{const n=+$('hold').value;if(Number.isFinite(n)&&n>=500&&n<=5000){config.technique.holdMs=n;gate=new GestureGate(config.technique);$('holdLabel').textContent=(n/1000).toFixed(1)+' s';}};
$('exportConfig').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jujutsu-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('importConfig').onchange=async e=>{try{const c=JSON.parse(await e.target.files[0].text());const v=c.technique,g=v.gesture;if(v.id!=='blue-adapted'||g.type!=='two-fingers')throw Error('Esta versión solo admite la técnica Azul adaptada.');for(const [k,min,max] of [['holdMs',500,5000],['lostGraceMs',0,500],['cooldownMs',1800,10000],['releaseMs',300,2000]])if(!Number.isFinite(v[k])||v[k]<min||v[k]>max)throw Error('Valor no válido: '+k);for(const [k,min,max] of [['extendedAngle',140,175],['foldedAngle',80,145],['minSeparation',.05,.5],['maxSeparation',.6,2],['minPalmPixels',30,150],['minPalmAspect',.15,.7]])if(!Number.isFinite(g[k])||g[k]<min||g[k]>max)throw Error('Umbral no válido: '+k);
 // Accept tuning only; never fetch resource paths from imported input.
 config.technique={...config.technique,gesture:{...g},holdMs:v.holdMs,lostGraceMs:v.lostGraceMs,cooldownMs:v.cooldownMs,releaseMs:v.releaseMs};gate=new GestureGate(config.technique);$('hold').value=v.holdMs;$('holdLabel').textContent=(v.holdMs/1000).toFixed(1)+' s';hint('Ajustes importados. Vuelve a seleccionar los recursos locales.');}catch(err){hint('Configuración rechazada: '+err.message);}};
$('docs').onclick=async()=>{$('docBody').textContent=await(await fetch('/project.txt')).text();$('documentation').showModal();};$('closeDocs').onclick=()=>$('documentation').close();
$('gojo').onclick=()=>hint('Gojo seleccionado. Técnica disponible: Azul adaptado.');$('blue').onclick=()=>hint(config.technique.instructions);
function draw(now){requestAnimationFrame(draw);ctx.clearRect(0,0,canvas.width,canvas.height);if(document.hidden)return;
 if(stage==='countdown'){const n=Math.ceil((countEnd-now)/1000);$('countdown').textContent=n>0?n:'YA';if(n<=0){$('countdown').hidden=true;stage='practice';state('PREPARACIÓN');}}
 if(running&&ready&&!busy&&cam.readyState>=2&&cam.currentTime!==lastFrame&&now-lastDispatch>50){lastFrame=cam.currentTime;const delta=now-lastDispatch;lastDispatch=now;fps=1000/delta;$('fps').textContent=Math.round(fps)+' FPS · LOCAL';busy=true;const ticket=session;createImageBitmap(cam).then(frame=>{if(!running||ticket!==session){frame.close();return;}worker.postMessage({type:'frame',frame,t:now},[frame]);}).catch(()=>{busy=false;hint('No se pudo leer el fotograma de cámara.');});}
 if(!canvas.width)return;const w=canvas.width,h=canvas.height;const map=p=>({x:(1-p.x)*w,y:p.y*h});
 if(tracked&&$('debug').checked){ctx.fillStyle='#a8eeff';ctx.strokeStyle='#73e3ff88';for(const path of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]){ctx.beginPath();path.forEach((i,n)=>{const p=map(tracked[i]);n?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();}tracked.forEach(p=>{const q=map(p);ctx.beginPath();ctx.arc(q.x,q.y,3,0,Math.PI*2);ctx.fill();});}
 const elapsed=now-burst,active=burst>0&&elapsed<config.technique.effect.durationMs;const charging=stage==='practice'&&latestGate.progress>0;let center=tracked?map(tracked[9]):null;if(!center&&active&&debugBurst)center={x:w*.5,y:h*.5};
 if(center&&(charging||active)){const intensity=+$('intensity').value,progress=active?1:latestGate.progress,radius=(active?75:18+progress*30)*Math.min(w/800,1.3);const fade=active?1-elapsed/config.technique.effect.durationMs:1;ctx.save();ctx.globalAlpha=fade*intensity;ctx.globalCompositeOperation='screen';const g=ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,radius*2);g.addColorStop(0,'#f1fbff');g.addColorStop(.15,'#8ae1ff');g.addColorStop(.45,'#206affaa');g.addColorStop(1,'#1849ff00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(center.x,center.y,radius*2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a4e4ff';ctx.lineWidth=1.5;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(center.x,center.y,radius*(1+i*.35),radius*(.3+i*.12),now/700+i,0,Math.PI*2);ctx.stroke();}for(let i=0;i<24;i++){const a=i*2.4+now/1300,rad=radius*(1+(i%5)/4);ctx.fillStyle='#9edfff';ctx.fillRect(center.x+Math.cos(a)*rad,center.y+Math.sin(a)*rad,2,2);}if(active){ctx.strokeStyle='#5eafff';ctx.beginPath();ctx.arc(center.x,center.y,radius+elapsed*.15,0,Math.PI*2);ctx.stroke();if(!$('reduced').checked&&elapsed<100){ctx.globalAlpha=.12*intensity;ctx.fillStyle='#c2efff';ctx.fillRect(0,0,w,h);}}ctx.restore();}
}
canvas.width=960;canvas.height=720;requestAnimationFrame(draw);
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetPractice();if(stage==='practice'||stage==='countdown'){stage='guide';$('countdown').hidden=true;hint('Práctica pausada. Pulsa Empezar práctica para continuar.');}}});
window.addEventListener('pagehide',()=>{stop();if(clipURL)URL.revokeObjectURL(clipURL);if(audioURL)URL.revokeObjectURL(audioURL);});
