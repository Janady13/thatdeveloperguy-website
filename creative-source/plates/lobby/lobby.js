const W=1672,H=941,world=document.getElementById('world'),layers=[...document.querySelectorAll('.L')];
let s=1,px=0,py=0,tx=0,ty=0;
function fit(){const vw=innerWidth,vh=innerHeight;s=Math.max(vw/W,vh/H)*1.04;world.style.transform=`translate(${vw/2-W*s/2}px,${vh/2-H*s/2}px) scale(${s})`}
addEventListener('resize',fit);fit();
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduce){addEventListener('pointermove',e=>{tx=(e.clientX/innerWidth-.5)*2;ty=(e.clientY/innerHeight-.5)*2});
(function loop(){px+=(tx-px)*.06;py+=(ty-py)*.06;for(const l of layers){const d=+l.dataset.depth;l.style.transform=`translate(${-px*d*28}px,${-py*d*14}px)`};document.getElementById('bg').style.transform=`translate(${px*6}px,${py*3}px) scale(1.012)`;requestAnimationFrame(loop)})()}

// fit each label to its plate (Public Sans is wider than the painted condensed lettering)
function fitLabels(){for(const l of document.querySelectorAll('.label')){const sp=l.firstElementChild;sp.style.transform='';const max=l.clientWidth-18,w=sp.getBoundingClientRect().width/s;if(w>max)sp.style.transform=`scale(${(max/w).toFixed(3)})`}}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitLabels);else fitLabels();addEventListener('resize',fitLabels);
