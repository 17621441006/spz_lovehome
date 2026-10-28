import assert from 'node:assert/strict';
import {Sound} from '../dist/src/audio.js';

// Record the Web Audio graph/envelopes without playing sound or loading files.
class Param{
 constructor(value=0){this.value=value;this.events=[];}
 record(type,value,time,extra){this.events.push({type,value,time,extra});return this;}
 setValueAtTime(v,t){return this.record('set',v,t);}
 linearRampToValueAtTime(v,t){return this.record('linear',v,t);}
 exponentialRampToValueAtTime(v,t){return this.record('exponential',v,t);}
 setTargetAtTime(v,t,c){return this.record('target',v,t,c);}
 cancelScheduledValues(t){return this.record('cancel',null,t);}
}
class Node{
 constructor(kind){this.kind=kind;this.connections=[];this.gain=new Param(1);this.frequency=new Param();this.Q=new Param();this.playbackRate=new Param(1);}
 connect(n){this.connections.push(n);return n;}
 disconnect(){this.connections=[];}
 start(t=0){this.startTime=t;}
 stop(t){this.stopTime=t;}
}
class AudioContext{
 constructor(){this.currentTime=0;this.sampleRate=8000;this.nodes=[];this.destination=new Node('destination');}
 node(kind){const n=new Node(kind);this.nodes.push(n);return n;}
 createGain(){return this.node('gain');}
 createBiquadFilter(){return this.node('filter');}
 createOscillator(){return this.node('oscillator');}
 createBufferSource(){return this.node('source');}
 createBuffer(channels,len,rate){const data=Array.from({length:channels},()=>new Float32Array(len));return {duration:len/rate,numberOfChannels:channels,getChannelData:i=>data[i]};}
 resume(){}
}
globalThis.window={AudioContext};
globalThis.fetch=()=>Promise.reject(new Error('No asset fetch in audio test'));
const sound=new Sound();sound.init();const c=sound.ctx;
sound.setRain(1);const maxRain=sound.rainGain.gain.events.filter(e=>e.type==='target').at(-1);
assert(maxRain.value<=.04,'Rain amplitude must remain gentle');
assert(maxRain.extra>=.25,'Rain changes must fade, not click');
assert.equal(sound.rainGain.gain.value,0,'Rain starts silent');
const rainSource=c.nodes.find(n=>n.kind==='source');
assert.equal(rainSource.buffer.numberOfChannels,2);
for(let ch=0;ch<2;ch++){
 const data=rainSource.buffer.getChannelData(ch);assert.equal(data[0],data.at(-1),'Loop seam must be continuous');
 let peak=0,energy=0;for(const v of data){assert(Number.isFinite(v));peak=Math.max(peak,Math.abs(v));energy+=v*v;}
 assert(peak<1,'Noise must not clip');assert(Math.sqrt(energy/data.length)<.35,'Ambience must have low RMS');
}
sound.setRain(-10);assert.equal(sound.rainLevel,0);sound.setRain(Infinity);assert.equal(sound.rainLevel,0);
sound.setRain(8);assert.equal(sound.rainLevel,1);
const start=c.nodes.length;sound.waterNotice();const cue=c.nodes.slice(start);
assert.equal(cue.filter(n=>n.kind==='oscillator').length,2);
for(const g of cue.filter(n=>n.kind==='gain')){
 assert.equal(g.gain.events[0].value,0,'Water cues must have a soft zero attack');
 assert(Math.max(...g.gain.events.filter(e=>e.value!==null).map(e=>e.value))<=.05,'Water cue must be quiet');
}
const count=c.nodes.length;sound.waterNotice();assert.equal(c.nodes.length,count,'Repeated water cues must be throttled');
c.currentTime=2;sound.waterNotice();assert(c.nodes.length>count);
sound.setEnabled(false);assert.equal(sound.master.gain.events.at(-1).value,0);
const muted=c.nodes.length;c.currentTime=5;sound.waterNotice();assert.equal(c.nodes.length,muted);
console.log(JSON.stringify({rain:'gentle stereo, continuous loop, smoothed gain',water:'soft attack, low peak, debounced',mute:'PASS'},null,2));
