(() => {
  const data = window.MCNS_DATA;
  const canvas = document.getElementById('brainCanvas');
  const ctx = canvas.getContext('2d');
  const prompt = document.getElementById('prompt');
  const runBtn = document.getElementById('runBtn');
  const runStatus = document.getElementById('runStatus');
  const consoleOutput = document.getElementById('consoleOutput');
  const cycleLabel = document.getElementById('cycleLabel');
  const graphBadge = document.getElementById('graphBadge');
  const modelBadge = document.getElementById('modelBadge');
  const regionName = document.getElementById('regionName');
  const regionRole = document.getElementById('regionRole');
  const regionStage = document.getElementById('regionStage');
  const regionOrb = document.getElementById('regionOrb');
  const synapseValue = document.getElementById('synapseValue');
  const confidenceValue = document.getElementById('confidenceValue');
  const synapseMeter = document.getElementById('synapseMeter');
  const confidenceMeter = document.getElementById('confidenceMeter');

  const regions = [
    {name:'Visual system', role:'Simulated sensory input', color:'#73c7ff'},
    {name:'Association circuit', role:'Simulated recurrent activity', color:'#c5a2ff'},
    {name:'Central complex', role:'Simulated signal routing', color:'#ff9b54'},
    {name:'Olfactory / GNG', role:'Simulated signal integration', color:'#7df7cc'},
    {name:'Motor output', role:'Simulated output activity', color:'#f98bb3'}
  ];
  const phases = ['sensory encoding','association','recurrent propagation','decision attractor','motor readout'];
  const nodeById = new Map(data.nodes.map(n => [n.id, n]));
  const outgoing = new Map();
  data.edges.forEach(edge => {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source).push(edge);
  });

  let W=800, H=460, dpr=Math.min(2, window.devicePixelRatio||1), running=false;
  let rotationX=-0.14, rotationY=0.58, zoom=1, dragging=false, lastPointer=[0,0];
  let activeSkeletonIds=new Set(), activeRegion=2, thinkingStarted=0;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

  const allCoords=[];
  data.skeletons.forEach(s => s.segments.forEach(seg => allCoords.push([seg[0],seg[1],seg[2]],[seg[3],seg[4],seg[5]])));
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  allCoords.forEach(p=>p.forEach((v,i)=>{bounds.min[i]=Math.min(bounds.min[i],v);bounds.max[i]=Math.max(bounds.max[i],v);}));
  const center=bounds.min.map((v,i)=>(v+bounds.max[i])/2);
  const span=Math.max(...bounds.min.map((v,i)=>bounds.max[i]-v))||1;

  // Wavefronts illuminate only the supplied SWC segments, retaining every 3D coordinate.
  // Their timing is an illustrative mapping of the simulation, not measured conduction.
  const morphology=data.skeletons.map(skeleton=>{
    const origin=skeleton.segments[0]?.slice(0,3)||center;
    const distance=p=>Math.hypot(p[0]-origin[0],p[1]-origin[1],p[2]-origin[2]);
    const distances=skeleton.segments.map(seg=>[distance(seg.slice(0,3)),distance(seg.slice(3,6))]);
    const extent=Math.max(1,...distances.flat());
    return {...skeleton,distances:distances.map(pair=>pair.map(v=>v/extent))};
  });

  function resize(){const rect=canvas.getBoundingClientRect();W=rect.width;H=rect.height;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);}
  function project(x,y,z){
    let px=x-center[0],py=y-center[1],pz=z-center[2];
    const cy=Math.cos(rotationY),sy=Math.sin(rotationY),cx=Math.cos(rotationX),sx=Math.sin(rotationX);
    const x1=cy*px+sy*pz,z1=-sy*px+cy*pz,y1=cx*py-sx*z1,z2=sx*py+cx*z1;
    const perspective=1/(1+z2/(span*3.2));
    const scale=Math.min(W,H)*1.12/span*zoom*perspective;
    return {x:W/2+x1*scale,y:H/2+y1*scale,z:z2};
  }
  function draw(t=0){
    ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.fillStyle='#000000';ctx.fillRect(0,0,W,H);
    morphology.forEach(skeleton=>{
      const active=running&&activeSkeletonIds.has(skeleton.id),color=regions[skeleton.group]?.color||'#a3dfff';
      const segments=skeleton.segments.map(seg=>[project(seg[0],seg[1],seg[2]),project(seg[3],seg[4],seg[5])]);
      ctx.beginPath();
      segments.forEach(([a,b])=>{ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);});
      ctx.strokeStyle=color;ctx.globalAlpha=.66;ctx.lineWidth=.85;ctx.shadowBlur=4;ctx.shadowColor=color;ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
      if(active){
        const time=(t-thinkingStarted)/1000;
        // A traveling band becomes a branching lightning trace with a blue halo and white core.
        for(let band=0;band<3;band++){
          const head=reducedMotion.matches?.65:((time*.85+band/3+(skeleton.id%17)/17)%1.35);
          const width=reducedMotion.matches?.5:.17;
          ctx.beginPath();
          segments.forEach(([a,b],i)=>{
            const [da,db]=skeleton.distances[i],delta=db-da;
            if(Math.max(da,db)<head-width||Math.min(da,db)>head)return;
            let from=0,to=1;
            if(Math.abs(delta)>.00001){const u=(head-width-da)/delta,v=(head-da)/delta;from=Math.max(0,Math.min(u,v));to=Math.min(1,Math.max(u,v));}
            if(from>to)return;
            ctx.moveTo(a.x+(b.x-a.x)*from,a.y+(b.y-a.y)*from);
            ctx.lineTo(a.x+(b.x-a.x)*to,a.y+(b.y-a.y)*to);
          });
          ctx.lineCap='round';ctx.lineJoin='round';
          ctx.strokeStyle='#259dff';ctx.lineWidth=3.4;ctx.globalAlpha=.38;ctx.shadowColor='#087dff';ctx.shadowBlur=18;ctx.stroke();
          ctx.strokeStyle='#8ee9ff';ctx.lineWidth=1.65;ctx.globalAlpha=.85;ctx.shadowBlur=6;ctx.stroke();
          ctx.strokeStyle='#efffff';ctx.lineWidth=.65;ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.stroke();
          if(reducedMotion.matches)break;
        }
      }
    });
    requestAnimationFrame(draw);
  }

  function hashText(text){return [...text].reduce((n,ch)=>(n*33+ch.charCodeAt(0))>>>0,5381);}
  function semanticRegion(text){const q=text.toLowerCase();if(/light|color|see|sky|speed/.test(q))return 0;if(/remember|history|learn|why/.test(q))return 1;if(/move|walk|turn|action/.test(q))return 4;if(/smell|taste|food/.test(q))return 3;return 2;}
  function neuronSign(node){const nt=String(node?.nt||'').toLowerCase();return /gaba|glutamate/.test(nt)?-.72:1;}
  function simulate(text){
    const seed=hashText(text),preferred=semanticRegion(text),skeletonIds=data.skeletons.filter(s=>s.group===preferred).map(s=>s.id),pool=data.nodes.filter(n=>n.group===preferred);
    const seeds=[...skeletonIds,...pool.sort((a,b)=>((a.id^seed)>>>0)-((b.id^seed)>>>0)).map(n=>n.id)].slice(0,8);
    let voltage=new Map(),current=new Set(seeds);const frames=[];let traversed=0,inhibited=0;
    for(let step=0;step<36;step++){
      const next=new Map();voltage.forEach((v,id)=>next.set(id,v*.84));
      current.forEach(id=>(outgoing.get(id)||[]).forEach(edge=>{const sign=neuronSign(nodeById.get(edge.source)),gain=sign*Math.min(1.9,Math.log1p(edge.weight)/3);next.set(edge.target,(next.get(edge.target)||0)+gain);traversed++;if(sign<0)inhibited++;}));
      let fired=[...next.entries()].filter(([,v])=>v>1.35).sort((a,b)=>b[1]-a[1]).slice(0,42).map(([id])=>id);
      if(!fired.length){const fallback=(outgoing.get([...current][0])||[]).sort((a,b)=>b.weight-a.weight)[0];fired=[fallback?.target||data.nodes[(seed+step*17)%data.nodes.length].id];}
      frames.push(fired);current=new Set(fired);voltage=next;
    }
    const counts=new Map();frames.flat().forEach(id=>counts.set(id,(counts.get(id)||0)+1));const winner=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
    return {seeds,frames,traversed,inhibited,winner,preferred};
  }
  function fallbackAnswer(question){
    const q=question.toLowerCase().trim();
    if(/speed of light/.test(q))return 'The speed of light in a vacuum is exactly 299,792,458 metres per second—about 300,000 kilometres per second.';
    if(/why.*sky.*blue|sky.*blue/.test(q))return 'The sky looks blue because air molecules scatter shorter blue wavelengths of sunlight more strongly than longer red wavelengths.';
    if(/17\s*(times|x|\*)\s*23/.test(q))return '17 × 23 = 391.';
    if(/capital.*france/.test(q))return 'Paris is the capital of France.';
    if(/boil.*water|water.*boil/.test(q))return 'At standard atmospheric pressure, pure water boils at 100 °C (212 °F).';
    return 'The offline micro-brain only knows a handful of facts. Start the local answer service for broader questions.';
  }
  async function getAnswer(question){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),48000);
    try{const response=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question}),signal:controller.signal});if(!response.ok)throw new Error('model unavailable');const result=await response.json();return {answer:result.answer,model:result.model||'mini model',live:true};}
    catch{return {answer:fallbackAnswer(question),model:'offline micro-facts',live:false};}
    finally{clearTimeout(timer);}
  }
  function modeRegion(ids){const counts=[0,0,0,0,0];ids.forEach(id=>{const n=nodeById.get(id);if(n)counts[n.group]++;});return counts.indexOf(Math.max(...counts));}
  function setRegion(index,stage){activeRegion=index;const r=regions[index];regionName.textContent=r.name;regionRole.textContent=r.role;regionStage.textContent=stage;regionOrb.style.background=r.color;regionOrb.style.boxShadow=running?'0 0 12px #8ee9ff':'none';}
  function visualSkeletons(ids,step){const hits=ids.filter(id=>data.skeletons.some(s=>s.id===id));if(hits.length)return new Set(hits);const group=modeRegion(ids),candidates=data.skeletons.filter(s=>s.group===group);return new Set((candidates.length?candidates:data.skeletons).filter((_,i)=>(i+step)%3===0).map(s=>s.id));}
  function safe(text){return String(text).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
  async function runQuestion(){
    if(running)return;
    const question=prompt.value.trim()||'What is the speed of light?';
    running=true;thinkingStarted=performance.now();canvas.dataset.state='thinking';
    runBtn.disabled=true;runBtn.textContent='Thinking…';runStatus.textContent='Following a thought';
    confidenceMeter.style.width='55%';confidenceValue.innerHTML='Thinking <em>locally</em>';
    let activityTimer;
    try{
      const sim=simulate(question);
      let step=0;
      function advance(){
        const frame=step===0?sim.seeds:sim.frames[(step-1)%sim.frames.length];
        activeSkeletonIds=visualSkeletons(frame,step);
        const region=step===0?sim.preferred:modeRegion(frame);
        setRegion(region,phases[Math.floor(step/4)%phases.length]);
        cycleLabel.textContent='Thinking · electrical activity';
        synapseValue.innerHTML=`${frame.length} <em>neurons firing</em>`;
        synapseMeter.style.width=`${Math.min(95,20+frame.length*1.8)}%`;
        step++;
      }
      advance();activityTimer=setInterval(advance,240);
      consoleOutput.innerHTML=`<span class="output-muted">Following the signal…</span>\n\n“${safe(question)}”`;
      const result=await getAnswer(question),winner=nodeById.get(sim.winner);
      consoleOutput.innerHTML=`${safe(result.answer)}\n\n<span class="output-muted">${result.live?'Answered locally · Qwen 0.5B':'Built-in fact fallback'}\n${sim.traversed.toLocaleString()} simulated weighted hops · ${sim.inhibited.toLocaleString()} inhibitory events\nDominant neuron: ${safe(winner?.type||`body ${sim.winner}`)}</span>`;
      modelBadge.textContent=result.live?'Local intelligence · Qwen 0.5B':'Built-in facts · model unavailable';
      confidenceValue.innerHTML=result.live?'0.5B <em>local model</em>':'Built-in <em>facts</em>';
      runStatus.textContent='Thought complete';
    }catch{
      consoleOutput.textContent='The thought was interrupted. Try asking again.';
      runStatus.textContent='Ready to retry';confidenceValue.innerHTML='Idle <em>local model</em>';
    }finally{
      // Reset every activation when the answer (or failure) arrives, including late requests.
      clearInterval(activityTimer);running=false;activeSkeletonIds.clear();
      canvas.dataset.state='idle';cycleLabel.textContent='At rest · no firing';
      synapseValue.innerHTML='At rest <em>no firing</em>';synapseMeter.style.width='0%';confidenceMeter.style.width='0%';
      regionName.textContent='Circuit at rest';regionRole.textContent='Waiting for the next question';regionStage.textContent='Quiet';regionOrb.style.background='#7593aa';regionOrb.style.boxShadow='none';
      runBtn.disabled=false;runBtn.textContent='Ask again ↗';
    }
  }

  canvas.addEventListener('pointerdown',event=>{dragging=true;lastPointer=[event.clientX,event.clientY];canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{if(!dragging)return;rotationY+=(event.clientX-lastPointer[0])*.009;rotationX+=(event.clientY-lastPointer[1])*.009;lastPointer=[event.clientX,event.clientY];});
  canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
  canvas.addEventListener('keydown',event=>{const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'];if(!keys.includes(event.key))return;event.preventDefault();if(event.key==='ArrowLeft')rotationY-=.12;if(event.key==='ArrowRight')rotationY+=.12;if(event.key==='ArrowUp')rotationX-=.12;if(event.key==='ArrowDown')rotationX+=.12;if(event.key==='+'||event.key==='=')zoom=Math.min(2.8,zoom*1.12);if(event.key==='-')zoom=Math.max(.45,zoom/1.12);});
  canvas.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(.45,Math.min(2.8,zoom*Math.exp(-event.deltaY*.001)));},{passive:false});
  document.getElementById('resetView').addEventListener('click',()=>{rotationX=-.14;rotationY=.58;zoom=1;});
  document.querySelectorAll('.preset').forEach(button=>button.addEventListener('click',()=>{prompt.value=button.dataset.prompt;prompt.focus();}));
  runBtn.addEventListener('click',runQuestion);prompt.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key==='Enter')runQuestion();});
  graphBadge.textContent=`MaleCNS v1.0 · ${data.skeletons.length} real neurons shown`;
  cycleLabel.textContent='At rest · no firing';canvas.dataset.state='idle';runStatus.textContent='Ready when you are';
  fetch('/api/model-status').then(r=>r.ok?r.json():Promise.reject()).then(status=>{modelBadge.textContent=status.ready?'Local intelligence · Qwen 0.5B':'Built-in facts · model unavailable';}).catch(()=>{modelBadge.textContent='Built-in facts · offline';});
  window.addEventListener('resize',resize);resize();requestAnimationFrame(draw);
})();
