// Lobby runtime: Rive scene + HTML signage glued to the same camera/parallax math as the .riv (rive/lobby/build-scene.py)
(function(){
const W=1672,H=941,CAMX=870,CAMY=400,PLANE_ROOM=[-6,-3],WALK_SCALE=0.24,WALK_Y=28;
const canvas=document.getElementById('lobby'),world=document.getElementById('world'),cam=document.getElementById('cam');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
rive.RuntimeLoader.setWasmUrl('/rive/rive-2.42.2.wasm');
let vmi=null,s=1,ox=0,oy=0,px=0,py=0,tx=0,ty=0,walk=0,walkT=0;
function fit(){const vw=innerWidth,vh=innerHeight;s=Math.max(vw/W,vh/H);ox=vw/2-W*s/2;oy=vh/2-H*s/2;world.style.transform=`translate(${ox}px,${oy}px) scale(${s})`;fitLabels()}
function fitLabels(){for(const l of document.querySelectorAll('.label')){const sp=l.firstElementChild;sp.style.transform='';const max=l.clientWidth-18,w=sp.getBoundingClientRect().width/(s*(1+WALK_SCALE*walk));if(w>max)sp.style.transform=`scale(${(max/w).toFixed(3)})`}}
function camera(){const sc=1+WALK_SCALE*walk,cy=CAMY+WALK_Y*walk,rx=-CAMX+PLANE_ROOM[0]*px,ry=-CAMY+PLANE_ROOM[1]*py;cam.style.transform=`translate(${CAMX}px,${cy}px) scale(${sc}) translate(${rx}px,${ry}px)`}
// plates: 2x by default, 4x when the device would upscale 2x (4K at 1x, or 3x-DPR phones/tablets); the .riv itself is 12 KB
const SET=(innerWidth*devicePixelRatio>3400)?'4x':'2x';
const plate=name=>fetch(`/assets/${SET}/${name}.webp`).then(res=>res.arrayBuffer()).then(buf=>rive.decodeImage(new Uint8Array(buf)));
const r=new rive.Rive({src:`/lobby-${SET}.riv`,canvas,
  assetLoader:(asset,bytes)=>{if(!asset.isImage||bytes.length>0)return false;plate(asset.name).then(img=>{asset.setRenderImage(img);img.unref()}).catch(e=>console.error('plate',asset.name,e));return true},artboard:'Lobby',stateMachine:'Lobby',autoplay:true,autoBind:true,
  layout:new rive.Layout({fit:rive.Fit.Cover,alignment:rive.Alignment.Center}),
  onLoad(){r.resizeDrawingSurfaceToCanvas();vmi=r.viewModelInstance;document.getElementById('stage').classList.add('live');fit();camera();
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitLabels)},
  onLoadError(e){console.error('rive load failed',e)}});
addEventListener('resize',()=>{r.resizeDrawingSurfaceToCanvas();fit();camera()});
let hidden=false,offscreen=false;const gate=()=>{if(hidden||offscreen)r.pause();else r.play()};
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;gate()});
new IntersectionObserver(es=>{offscreen=!es[0].isIntersecting;gate()},{threshold:0}).observe(document.getElementById('stage'));
// touch: no hover, so a tap on a door counts as its click; a slow drift keeps the parallax alive without a pointer
if(matchMedia('(hover: none)').matches&&!reduce){let t=0;setInterval(()=>{t+=.02;tx=Math.sin(t)*.35;ty=Math.cos(t*.7)*.2},40)}
// pointer -> parallax
if(!reduce){addEventListener('pointermove',e=>{tx=(e.clientX/innerWidth-.5)*2;ty=(e.clientY/innerHeight-.5)*2},{passive:true});
  addEventListener('scroll',()=>{walkT=Math.min(1,Math.max(0,scrollY/(innerHeight*1.3)))},{passive:true})}
(function loop(){px+=(tx-px)*.05;py+=(ty-py)*.05;walk+=(walkT-walk)*.08;
  if(vmi){vmi.number('parallaxX').value=px;vmi.number('parallaxY').value=py;vmi.number('walk').value=walk}
  tickDoors(performance.now());camera();requestAnimationFrame(loop)})();
// doors: the scene's click listener sets openX (view model); the host tweens doorX 0->1 which is data-bound to the hinge scale, shade and corridor light
const cap=d=>d==='it'?'It':d[0].toUpperCase()+d.slice(1);
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const doors={};
function openDoor(d){if(!vmi||doors[d])return;doors[d]={t0:performance.now()};vmi.boolean('open'+cap(d)).value=true}
function tickDoors(now){if(!vmi)return;for(const d of ['it','gov','cyber']){const o=doors[d],p=vmi.number('door'+cap(d));
  if(!o){if(vmi.boolean('open'+cap(d)).value)openDoor(d);continue}
  const t=now-o.t0;let v;
  if(t<700)v=ease(t/700);else if(t<2100)v=1;else if(t<2700)v=1-ease((t-2100)/600);else{v=0;doors[d]=null;vmi.boolean('open'+cap(d)).value=false}
  p.value=v}}
for(const a of document.querySelectorAll('nav a[data-door]')){const d=a.dataset.door;
  a.addEventListener('pointerenter',()=>{if(vmi)vmi.boolean('hover'+cap(d)).value=true});
  a.addEventListener('pointerleave',()=>{if(vmi)vmi.boolean('hover'+cap(d)).value=false});
  a.addEventListener('click',e=>{e.preventDefault();openDoor(d)})}
})();
