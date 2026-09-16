// Digital Steward lab: drives the rig's view model (rive/steward/build-rig.py contract). Plates arrive through assetLoader (2x, or 4x on dense displays).
(function(){
const canvas=document.getElementById('hero'),status=document.getElementById('status');
rive.RuntimeLoader.setWasmUrl('/animation/runtime/rive.wasm');
const SET=(innerHeight*devicePixelRatio>1900)?'4x':'2x';
const plate=name=>fetch(`/lab/steward/assets/${SET}/${name}.webp`).then(r=>r.arrayBuffer()).then(b=>rive.decodeImage(new Uint8Array(b)));
let vmi=null,follow=true,tx=0,ty=0,lx=0,ly=0,demo=null;
const r=new rive.Rive({src:`/lab/steward/assets/steward-${SET}.riv`,canvas,artboard:'Hero',stateMachine:'HeroMachine',autoplay:true,autoBind:true,
  assetLoader:(asset,bytes)=>{if(!asset.isImage||bytes.length>0)return false;plate(asset.name).then(img=>{asset.setRenderImage(img);img.unref()}).catch(e=>console.error('plate',asset.name,e));return true},
  layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),
  onLoad(){r.resizeDrawingSurfaceToCanvas();vmi=r.viewModelInstance;status.textContent=`live · ${SET} plates`},
  onLoadError(e){status.textContent='load failed';console.error(e)}});
addEventListener('resize',()=>r.resizeDrawingSurfaceToCanvas());
const num=(n,v)=>{if(vmi)vmi.number(n).value=v};
// gesture: the machine leaves the clip on exit time; the host clears the number so the same clip can fire again
function gesture(k){num('gesture',k);setTimeout(()=>num('gesture',0),140);for(const b of document.querySelectorAll('[data-gesture]'))b.classList.toggle('on',+b.dataset.gesture===k);setTimeout(()=>{for(const b of document.querySelectorAll('[data-gesture]'))b.classList.remove('on')},1500)}
for(const b of document.querySelectorAll('[data-gesture]'))b.addEventListener('click',()=>gesture(+b.dataset.gesture));
for(const b of document.querySelectorAll('[data-blink]'))b.addEventListener('click',()=>{num('blink',+b.dataset.blink);setTimeout(()=>num('blink',0),140)});
document.getElementById('idle').addEventListener('change',e=>num('idle',+e.target.value));
document.getElementById('expression').addEventListener('change',e=>num('expression',+e.target.value));
document.getElementById('painted').addEventListener('click',e=>{const on=e.target.classList.toggle('on');num('paintedFace',on?1:0)});
document.getElementById('follow').addEventListener('click',e=>{follow=e.target.classList.toggle('on');if(!follow){tx=ty=0}});
// gaze: pointer position relative to the head (about 17% down the contained artboard)
function headCenter(){const w=canvas.clientWidth,h=canvas.clientHeight,s=Math.min(w/640,h/960),ax=(w-640*s)/2,ay=(h-960*s)/2;return[ax+336*s,ay+165*s,s]}
addEventListener('pointermove',e=>{if(!follow)return;const rc=canvas.getBoundingClientRect(),[cx,cy,s]=headCenter();tx=Math.max(-1,Math.min(1,(e.clientX-rc.left-cx)/(420*s)));ty=Math.max(-1,Math.min(1,(e.clientY-rc.top-cy)/(420*s)))},{passive:true});
(function loop(){lx+=(tx-lx)*.12;ly+=(ty-ly)*.12;num('lookX',lx);num('lookY',ly);requestAnimationFrame(loop)})();
// auto demo: a conversation beat every few seconds
const SCRIPT=[[13,3000],[12,3400],[14,3400],[8,2000],[24,3200],[23,3400],[10,2200],[27,2600],[31,3000],[9,1800],[25,3200],[15,2600],[18,2600],[26,3200],[28,2700],[20,2400],[21,2400],[30,3000]];
document.getElementById('demo').addEventListener('click',e=>{const on=e.target.classList.toggle('on');if(!on){clearTimeout(demo);demo=null;return}let i=0;const step=()=>{const[g,ms]=SCRIPT[i++%SCRIPT.length];gesture(g);demo=setTimeout(step,ms)};step()});
let hidden=false;document.addEventListener('visibilitychange',()=>{hidden=document.hidden;hidden?r.pause():r.play()});
})();
