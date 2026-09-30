const grid=document.getElementById('case-grid');
const simforgeViewer=document.getElementById('simforge-viewer');
const articulationButtons=[...simforgeViewer.querySelectorAll('[data-articulation]')];
let activeJoint=null,jointOpen=false,jointFrame=0;
let collisionAudit=null;
const collisionReady=fetch('static/media/simforge-motion-collision.json').then(response=>{
  if(!response.ok)throw new Error('Collision audit unavailable');
  return response.json();
}).then(data=>{
  for(const name of ['Refrigerator','Wardrobe','Filing cabinet']){
    const limit=data.objects?.[name]?.safeFraction;
    if(!Number.isFinite(limit)||limit<0||limit>1)throw new Error('Invalid collision limit');
  }
  collisionAudit=data;
}).catch(()=>{});
simforgeViewer.animationCrossfadeDuration=0;
simforgeViewer.addEventListener('load',async()=>{
  await collisionReady;
  if(!collisionAudit){
    document.getElementById('simforge-status').textContent='Collision checks unavailable; articulation controls are disabled.';
    return;
  }
  articulationButtons.forEach(b=>{b.disabled=!simforgeViewer.availableAnimations.includes(b.dataset.articulation)});
  document.getElementById('simforge-status').textContent='Click a labeled object to open or close it · motion stops at the sampled external-obstacle limit.';
});
articulationButtons.forEach(button=>button.addEventListener('click',()=>{
  const name=button.dataset.articulation;
  if(!collisionAudit)return;
  const collision=collisionAudit.objects[name];
  if(collision.safeFraction===0){
    document.getElementById('simforge-status').textContent=`${name}: motion blocked by an existing scene intersection. No opening is allowed.`;
    return;
  }
  const views={Refrigerator:['.48m 1m -7.5m','0deg 30deg 4.5m'],Wardrobe:['6.3m 1m -.35m','180deg 30deg 5.5m'],'Filing cabinet':['8.25m .7m -6.65m','0deg 45deg 4m']};
  simforgeViewer.cameraTarget=views[name][0];
  simforgeViewer.cameraOrbit=views[name][1];
  cancelAnimationFrame(jointFrame);
  simforgeViewer.pause();
  if(activeJoint!==name){
    activeJoint=name;jointOpen=false;
    simforgeViewer.animationName=name;
    simforgeViewer.currentTime=0;
  }
  jointOpen=!jointOpen;
  jointFrame=requestAnimationFrame(()=>{
    jointFrame=requestAnimationFrame(()=>{
      const start=simforgeViewer.currentTime;
      const end=jointOpen?Math.max(0,(simforgeViewer.duration-.001)*collision.safeFraction):0;
      simforgeViewer.dataset.animationDuration=String(simforgeViewer.duration);
      const began=performance.now();
      const advance=now=>{
        const t=Math.min(1,(now-began)/1200);
        const eased=t*t*(3-2*t);
        simforgeViewer.currentTime=start+(end-start)*eased;
        simforgeViewer.dataset.animationTime=String(simforgeViewer.currentTime);
        if(t<1)jointFrame=requestAnimationFrame(advance);
        else if(jointOpen&&collision.firstCollision){
          document.getElementById('simforge-status').textContent=`${name}: stopped before a sampled collision with ${collision.firstCollision.obstacles.map(x=>x.replaceAll('_',' ')).join(', ')}. Click again to close.`;
        }
      };
      jointFrame=requestAnimationFrame(advance);
    });
  });
  articulationButtons.forEach(b=>b.setAttribute('aria-label',`${b===button&&jointOpen?'Close':'Open'} ${b.dataset.articulation}`));
  document.getElementById('simforge-status').textContent=`${name}: ${jointOpen?'opening':'closing'} · click again to ${jointOpen?'close':'open'}. Selecting another object resets the previous preview.`;
}));
simforgeViewer.addEventListener('error',()=>{document.getElementById('simforge-status').textContent='Unable to load the apartment. Please retry.'});
document.getElementById('simforge-reset').addEventListener('click',()=>{
  cancelAnimationFrame(jointFrame);simforgeViewer.pause();simforgeViewer.currentTime=0;
  activeJoint=null;jointOpen=false;
  articulationButtons.forEach(b=>b.setAttribute('aria-label',`Open ${b.dataset.articulation}`));
  simforgeViewer.cameraTarget='auto auto auto';simforgeViewer.cameraOrbit='0deg 35deg auto';
  document.getElementById('simforge-status').textContent='Click a labeled object to open or close it · drag to rotate · scroll to zoom.';
});
for(const [id,direction] of [['asset-prev',-1],['asset-next',1]])document.getElementById(id).addEventListener('click',()=>{const gallery=document.getElementById('asset-grid');gallery.scrollBy({left:direction*(gallery.clientWidth+22),behavior:'smooth'})});
function showCases(group){const prefix=group==='real'?'RealCase':'GenCase';grid.replaceChildren();for(let i=1;i<=4;i++){const card=document.createElement('button');card.type='button';card.className='case-card scene-choice';card.dataset.case=`${prefix}_${i}`;card.setAttribute('aria-label',`View ${group==='real'?'real':'synthesized'} scene ${i}`);const img=document.createElement('img');img.src=`static/media/DataShow/${prefix}_${i}/image.jpg`;img.alt=`${group==='real'?'Real':'Synthesized'} input scene ${i}`;img.loading='lazy';const caption=document.createElement('span');caption.textContent=`${group==='real'?'Real':'Synthesized'} scene ${String(i).padStart(2,'0')}`;card.append(img,caption);card.addEventListener('click',()=>selectScene(card.dataset.case));grid.append(card)}}showCases('real');
document.querySelectorAll('[data-group]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-group]').forEach(b=>b.classList.toggle('active',b===button));showCases(button.dataset.group);selectScene(button.dataset.group==='real'?'RealCase_1':'GenCase_1')}));
const viewer=document.getElementById('scene-viewer'),status=document.getElementById('model-status');
function selectScene(id){const real=id.startsWith('RealCase'),i=id.split('_')[1];document.querySelectorAll('.scene-choice').forEach(b=>b.classList.toggle('active',b.dataset.case===id));document.getElementById('paired-input').src=`static/media/DataShow/${id}/image.jpg`;document.getElementById('paired-input').alt=`${real?'Real':'Synthesized'} input for Unravel scene ${i}`;document.getElementById('paired-caption').textContent=`${real?'Real':'Synthesized'}-image example ${i}`;viewer.src=`static/media/DataShow/${id}/results.glb`;viewer.alt=`Unravel reconstruction from ${real?'real':'synthesized'} input ${i}`;if(viewer.dismissPoster)viewer.dismissPoster();status.textContent='Loading reconstructed scene…';}
viewer.addEventListener('load',()=>{status.textContent='Rotate · zoom · inspect'});viewer.addEventListener('error',()=>{status.textContent='Unable to load this scene. Please retry.'});
const assets=[['microwave_076','Microwave','png'],['iro0224_mix_177_cabinet','Cabinet','webp'],['nightstand_0637_nightstand','Nightstand','webp'],['washer_final','Washing machine','png'],['s1630_mixed_case_oven','Oven','webp'],['iro0224_mix_112_Wooden keepsake box','Keepsake box','webp'],['iro0224_mix_085_knife','Folding knife','webp'],['iro0224_mix_109_trashcan','Trash can','webp'],['iro0224_mix_134_box','Box','webp'],['iro0224_mix_165_toilet','Toilet','webp']];
assets.forEach(([id,name,extension],i)=>{const base=`static/media/articulation/select/${encodeURIComponent(id)}/`;const card=document.createElement('article');card.className='asset-card';const title=document.createElement('h3');title.textContent=name;const media=document.createElement('div');media.className='asset-media';const input=document.createElement('div'),output=document.createElement('div'),img=document.createElement('img'),video=document.createElement('video');img.src=base+'input.'+extension;img.alt=`${name} reference input`;img.loading='lazy';video.src=base+'motion.mp4';video.poster=base+'preview.webp';video.muted=true;video.loop=true;video.playsInline=true;video.controls=true;video.preload='none';video.setAttribute('aria-label',`${name} generated articulation motion`);video.addEventListener('pointerenter',()=>video.play().catch(()=>{}));video.addEventListener('pointerleave',()=>video.pause());for(const [parent,child,label]of[[input,img,'REFERENCE'],[output,video,'GENERATED MOTION']]){const caption=document.createElement('p');caption.textContent=label;parent.append(child,caption)}media.append(input,output);card.append(title,media);document.getElementById('asset-grid').append(card)});
// Use lightweight motion cards instead of full video-player chrome.
const motionObserver=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting)target.play().catch(()=>{});else target.pause()}),{threshold:0.35});
document.querySelectorAll('.asset-media video').forEach(video=>{video.controls=false;video.tabIndex=0;video.title='Click to play or pause motion';video.addEventListener('click',()=>video.paused?video.play().catch(()=>{}):video.pause());video.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();video.click()}});motionObserver.observe(video)});
