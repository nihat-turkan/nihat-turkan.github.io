// Isolated experiment host. No island scene or other experiment is loaded.
import * as THREE from './vendor/three.module.js';
try {
  const key=document.body.dataset.experiment,spec=window.OYUNLAR[key],LIB=window.KUTUPHANE;
  const renderer=new THREE.WebGLRenderer({antialias:false}),out=renderer.domElement;out.id='fx';out.tabIndex=0;out.setAttribute('aria-label',spec.title+' interactive experiment');document.getElementById('fx').replaceWith(out);
  const parts=createParts(THREE,renderer),look=createLook(THREE,renderer),C=look.rolesOf(look.PALS.c),structures=createStructures(THREE,parts),CHARS=Object.fromEntries([...LIB.karakterler,...(LIB.sakinler||[])].map(c=>[c.id,c]));
  const rec=LIB.mekanlar.find(p=>p.place===key),place=structures.build(rec,C,id=>parts.build(CHARS[id],C)),scene=new THREE.Scene();scene.add(place.root);look.patchObject(place.root);
  const cam=new THREE.OrthographicCamera(-1,1,1,-1,.1,200),light=new THREE.DirectionalLight(0xffffff,1.3);light.position.set(5,8,6);scene.add(light,new THREE.AmbientLight(0xffffff,2.1));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const settings={...look.DEFAULTS,time:'day',paint:0},store={get(k,f){try{return JSON.parse(localStorage.getItem('experiment-'+key+'-'+k))??f;}catch{return f;}},set(k,v){try{localStorage.setItem('experiment-'+key+'-'+k,JSON.stringify(v));}catch{}}};
  let shift=0,night=false;
  const shell=createGameShell(THREE,{scene,cam,out,store,parts,look,C,CHARS,places:{[key]:{key,rec,pos:new THREE.Vector3(),s:place}},isNight:()=>night,onExit:()=>{shell.stop();shell.start(key);},shift:dx=>{shift=dx;}});
  shell.start(key);
  function camera(){const game=shell.current().game,vw={...spec.view,...(game.view?game.view():{})},target=new THREE.Vector3(...vw.at),yaw=vw.yaw||0,pitch=vw.pitch,dist=80,a=out.clientWidth/Math.max(1,out.clientHeight);target.x+=Math.cos(yaw)*shift;target.z-=Math.sin(yaw)*shift;Object.assign(cam,{left:-7.4*a,right:7.4*a,top:7.4,bottom:-7.4});cam.zoom=vw.zoom;cam.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*dist,target.y+Math.sin(pitch)*dist,target.z+Math.cos(yaw)*Math.cos(pitch)*dist);cam.lookAt(target);cam.updateProjectionMatrix();cam.updateMatrixWorld();}
  document.getElementById('gameBack').textContent='↺ RESTART';
  document.getElementById('standaloneMode').onclick=()=>{night=!night;settings.time=night?'night':'day';document.body.classList.toggle('night',night);document.body.classList.toggle('day',!night);document.getElementById('standaloneMode').textContent=night?'DAY':'NIGHT';};
  document.getElementById('loadStatus').hidden=true;
  function frame(ms){camera();shell.frame(ms/1000);place.anims.forEach(fn=>fn(ms/1000));place.chars.forEach(ch=>parts.animate(ch,ms/1000));look.render(out,scene,cam,new THREE.Color(night?C.ink:C.paper),settings,Math.min(devicePixelRatio||1,1.5),1);requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.dataset.tab==='play'){e.preventDefault();shell.stop();shell.start(key);}});
  addEventListener('pagehide',()=>shell.stop());
  window.__experiment={shell,scene,cam,place,renderer};
}catch(error){console.error(error);document.getElementById('loadStatus').hidden=false;document.getElementById('loadTitle').textContent='Experiment could not load';document.getElementById('loadMessage').textContent='Open this folder through a local web server. WebGL is required.';}
