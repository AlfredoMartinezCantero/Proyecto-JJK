import {FilesetResolver,HandLandmarker} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/vision_bundle.mjs';
let detector;
self.onmessage=async({data})=>{
 try{
 if(data.type==='init'){
 const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
 detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
 self.postMessage({type:'ready'});
 }else if(data.type==='frame'){
 try{const r=detector.detectForVideo(data.frame,data.t);self.postMessage({type:'result',t:data.t,hands:r.landmarks});}finally{data.frame.close();}
 }
 }catch(e){self.postMessage({type:'error',message:e.message});}
};
