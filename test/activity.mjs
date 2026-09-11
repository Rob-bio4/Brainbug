import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual frontend against deferred answers and a recording canvas.
// This verifies the visual lifecycle without depending on inference speed.
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const graph=await readFile(new URL('../public/mcns-data.js',import.meta.url),'utf8');
const intervals=new Map();
let nextId=0,animationFrame,answerRequest,commands=[];
const context2d={
  setTransform(){},
  fillRect(...args){commands.push(['background',this.fillStyle,...args]);},
  beginPath(){},moveTo(){},lineTo(){},
  stroke(){commands.push(['stroke',this.strokeStyle,this.lineWidth,this.globalAlpha]);},
  arc(){throw new Error('Sphere/ring effect was reintroduced');}
};
const elements=new Map();
function element(id){
  if(!elements.has(id))elements.set(id,{
    style:{},dataset:{},listeners:{},value:'What is the speed of light?',
    addEventListener(name,fn){this.listeners[name]=fn;},
    getBoundingClientRect(){return {width:800,height:460};},
    getContext(){return context2d;},setPointerCapture(){}
  });
  return elements.get(id);
}
const sandbox={
  console,performance:{now:()=>0},AbortController,
  window:{devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false})},
  document:{getElementById:element,querySelectorAll:()=>[]},
  requestAnimationFrame(fn){animationFrame=fn;},
  setInterval(fn){const id=++nextId;intervals.set(id,fn);return id;},
  clearInterval(id){intervals.delete(id);},
  setTimeout(){return ++nextId;},clearTimeout(){},
  fetch(url){
    if(url==='/api/model-status')return Promise.resolve({ok:true,json:async()=>({ready:true})});
    return new Promise((resolve,reject)=>{answerRequest={resolve,reject};});
  }
};
vm.createContext(sandbox);vm.runInContext(graph,sandbox);vm.runInContext(app,sandbox);
function render(t){commands=[];animationFrame(t);return JSON.stringify(commands);}
const idle=render(0);
assert.equal(idle,render(1000),'Initial resting specimen must be static');
assert.equal(element('brainCanvas').dataset.state,'idle');
assert.ok(commands.every(c=>c[0]!=='background'||c[1]==='#000000'));

for(const fail of [false,true,false]){
  const pending=element('runBtn').listeners.click();
  assert.equal(element('brainCanvas').dataset.state,'thinking');
  render(250);
  assert.ok(commands.some(c=>c[1]==='#efffff'),'Thinking must render white electrical cores');
  assert.equal(intervals.size,1);
  // Keep waiting beyond the old five-step animation and confirm activity continues.
  for(let n=0;n<30;n++)for(const fn of intervals.values())fn();
  render(7500);
  assert.ok(commands.some(c=>c[1]==='#efffff'),'Activity must continue while the model is pending');
  if(fail)answerRequest.reject(new Error('offline'));
  else answerRequest.resolve({ok:true,json:async()=>({answer:'299,792,458 m/s',model:'local'})});
  await pending;
  assert.equal(element('brainCanvas').dataset.state,'idle');
  assert.equal(intervals.size,0,'Activity timer must be cleared');
  assert.equal(element('runBtn').disabled,false);
  const settled=render(7600);
  assert.ok(!commands.some(c=>c[1]==='#efffff'),'No electrical cores after an answer/failure');
  assert.equal(settled,render(20000),'Post-answer rendering must stay static');
  assert.equal(element('synapseMeter').style.width,'0%');
}
console.log('PASS: pure black canvas, electrical traces while pending, immediate quiet after answers/failures, repeated questions, static idle frames.');
