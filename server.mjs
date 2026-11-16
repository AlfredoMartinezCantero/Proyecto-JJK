const tools=[{name:'get_project_plan',description:'Consulta el diseño, alcance, arquitectura, limitaciones y pruebas pendientes de Jujutsu Gesture Lab. Usa este contexto al ayudar a desarrollar la experiencia. No afirma validación humana ni sellos canónicos verificados.',inputSchema:{type:'object',properties:{},additionalProperties:false}},{name:'get_technique_config',description:'Obtiene la configuración vigente de Azul de Gojo, una adaptación jugable de dos dedos para webcam. No opera la cámara: el usuario debe abrir la aplicación. Recursos locales aportados por el usuario, sin descargas de episodios.',inputSchema:{type:'object',properties:{},additionalProperties:false}}];
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
export default {async fetch(req){const path=new URL(req.url).pathname;
 if(path==='/mcp'){
 if(req.method!=='POST')return new Response('Use POST',{status:405,headers:{Allow:'POST'}});
 let r;try{r=await req.json();}catch{return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
 if(r.id===undefined)return new Response(null,{status:204});
 let result;
 if(r.method==='server/discover')result={supportedVersions:['2026-07-28'],capabilities:{tools:{}}};
 else if(r.method==='initialize')result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'jujutsu-gesture-lab',version:'0.1.0'}};
 else if(r.method==='ping')result={};
 else if(r.method==='tools/list')result={tools};
 else if(r.method==='tools/call'){
 const name=r.params?.name;if(!tools.some(t=>t.name===name))result={isError:true,content:[{type:'text',text:'Herramienta desconocida'}]};else result={content:[{type:'text',text:assets[name==='get_project_plan'?'/project.txt':'/config.json']}]};
 }else return json({jsonrpc:'2.0',id:r.id,error:{code:-32601,message:'Method not found'}});
 return json({jsonrpc:'2.0',id:r.id,result});
 }
 const body=assets[path];if(body===undefined)return new Response('Not found',{status:404});
 const type=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.json')?'application/json':path.endsWith('.txt')?'text/plain':'text/html';return new Response(body,{headers:{'content-type':type+'; charset=utf-8','x-content-type-options':'nosniff','permissions-policy':'camera=(self), microphone=()','cache-control':'no-cache'}});
}};
