import {FOREST_SCORE} from './forest-score.js';
// Tiny synthesized sound kit (no audio files needed)
export class Sound {
  constructor() { this.ctx = null; this.enabled = true; this.meowAt=-10; this.waterAt=-10; this.rainLevel=0; this.rainTarget=-1; this.musicVolume=.45; this.customAudio=null;this.trackIndex=0;this.trackRound=0; }
  init() {
    if (this.ctx) {this.ctx.resume(); return;}
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? .48 : 0; this.master.connect(this.ctx.destination);
    // Original soft rain on leaves: stereo, low-mid weighted noise, gently
    // band-limited. The old 2.5 kHz bed sounded like loud hiss on phone speakers.
    const len = this.ctx.sampleRate * 6, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const rainBuffer=this.ctx.createBuffer(2,len,this.ctx.sampleRate);
    for(let channel=0;channel<2;channel++){
      const data=rainBuffer.getChannelData(channel);let soft=0,deep=0;
      for(let i=0;i<len;i++){
        const white=Math.random()*2-1;soft=.75*soft+.25*white;deep=.985*deep+.015*white;
        data[i]=(soft*.75+deep*1.5+white*.06)*.8;
      }
      // Blend the loop seam so the long ambience has no repeating click.
      const seam=Math.min(1024,len/4|0);
      for(let i=0;i<seam;i++){const q=i/(seam-1),f=q*q*(3-2*q);data[len-seam+i]=data[len-seam+i]*(1-f)+data[0]*f;}
    }
    const src = this.ctx.createBufferSource(); src.buffer = rainBuffer; src.loop = true;
    const low = this.ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 1100; low.Q.value = .5;
    const high=this.ctx.createBiquadFilter();high.type='highpass';high.frequency.value=110;high.Q.value=.5;
    this.rainGain = this.ctx.createGain(); this.rainGain.gain.value = 0;
    src.connect(low);low.connect(high);high.connect(this.rainGain);this.rainGain.connect(this.master);src.start();
    this.setRain(this.rainLevel);
    this.musicGain=this.ctx.createGain();this.musicGain.gain.value=this.musicVolume;this.musicGain.connect(this.master);
    this.nextNote=0;this.beat=0;
    fetch('assets/audio/cat-softmew.wav').then(r=>r.arrayBuffer()).then(b=>this.ctx.decodeAudioData(b)).then(b=>this.meowBuffer=b).catch(()=>{});
    this.ctx.resume();
  }
  setEnabled(on) { this.enabled = on; if(on)this.init(); if (this.master) this.master.gain.setTargetAtTime(on ? .48 : 0,this.ctx.currentTime,.035); }
  get ok() { return this.ctx && this.enabled; }
  setRain(a) {
    this.rainLevel=Number.isFinite(a)?Math.max(0,Math.min(1,a)):0;
    const target=this.rainLevel*.035;
    if(this.rainGain&&Math.abs(target-this.rainTarget)>.0001){this.rainTarget=target;const t=this.ctx.currentTime;this.rainGain.gain.cancelScheduledValues(t);this.rainGain.gain.setTargetAtTime(target,t,.35);}
  }

  meow() {
    if(!this.ok||this.ctx.currentTime-this.meowAt<.9)return;
    const c=this.ctx,t=c.currentTime;this.meowAt=t;
    const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2600;filter.Q.value=.45;
    const gain=c.createGain();gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.48,t+.045);filter.connect(gain);gain.connect(this.master);
    if(this.meowBuffer){const src=c.createBufferSource();src.buffer=this.meowBuffer;src.playbackRate.value=.97;const dur=this.meowBuffer.duration/.97;gain.gain.setValueAtTime(.48,t+Math.max(.06,dur-.14));gain.gain.linearRampToValueAtTime(0,t+dur);src.connect(filter);src.start();src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};}
    else {const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(540,t);o.frequency.linearRampToValueAtTime(680,t+.16);o.frequency.exponentialRampToValueAtTime(430,t+.6);gain.gain.linearRampToValueAtTime(0,t+.7);o.connect(filter);o.start(t);o.stop(t+.72);}
  }

  boing() {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.12); o.frequency.exponentialRampToValueAtTime(260, t + 0.45);
    const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.5);
  }
  jump() {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.16);
  }
  chime(n = 0) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const notes = [1046, 1318, 1568, 2093];
    [0, 1].forEach(i => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = notes[(n + i) % 4] * (i ? 1.5 : 1);
      const g = c.createGain(); g.gain.setValueAtTime(0, t + i * 0.08); g.gain.linearRampToValueAtTime(0.25, t + i * 0.08 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.6);
      o.connect(g); g.connect(this.master); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.7);
    });
  }
  roar() {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(900, t + 0.5); lp.frequency.linearRampToValueAtTime(200, t + 2);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(110, t + 0.5); o.frequency.linearRampToValueAtTime(60, t + 2);
    const og = c.createGain(); og.gain.value = 0.35;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.25); g.gain.linearRampToValueAtTime(0.23, t + 1.4); g.gain.linearRampToValueAtTime(0, t + 2.1);
    src.connect(lp); lp.connect(g); o.connect(og); og.connect(lp); g.connect(this.master);
    src.start(t); src.stop(t + 2.2); o.start(t); o.stop(t + 2.2);
  }
  // A small ripple and two rounded water drops, never a startled vocal.
  // Cooldown also prevents rapid overlapping cues when standing at the bank.
  waterNotice() {
    if(!this.ok||this.ctx.currentTime-this.waterAt<1.8)return;
    const c=this.ctx,t=c.currentTime;this.waterAt=t;
    const src=c.createBufferSource();src.buffer=this.noiseBuf;
    const low=c.createBiquadFilter();low.type='lowpass';low.frequency.value=680;low.Q.value=.45;
    const g=c.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.028,t+.09);g.gain.exponentialRampToValueAtTime(.0001,t+.65);
    src.connect(low);low.connect(g);g.connect(this.master);src.start(t);src.stop(t+.7);
    src.onended=()=>{src.disconnect();low.disconnect();g.disconnect();};
    [0,.14].forEach((delay,i)=>{
      const o=c.createOscillator(),gain=c.createGain();o.type='sine';
      o.frequency.setValueAtTime(i?490:370,t+delay);o.frequency.exponentialRampToValueAtTime(i?440:330,t+delay+.32);
      gain.gain.setValueAtTime(0,t+delay);gain.gain.linearRampToValueAtTime(.045,t+delay+.05);gain.gain.exponentialRampToValueAtTime(.0001,t+delay+.40);
      o.connect(gain);gain.connect(this.master);o.start(t+delay);o.stop(t+delay+.44);o.onended=()=>{o.disconnect();gain.disconnect();};
    });
  }
  splash(){this.waterNotice();}
  setMusicVolume(value){this.musicVolume=value;if(this.musicGain)this.musicGain.gain.setTargetAtTime(value,this.ctx.currentTime,.08);}
  async loadMusic(file){
    this.init();if(this.customAudio){this.customAudio.pause();URL.revokeObjectURL(this.customAudio.src);this.customNode?.disconnect();}
    this.customAudio=new Audio(URL.createObjectURL(file));this.customAudio.loop=true;
    this.customNode=this.ctx.createMediaElementSource(this.customAudio);this.customNode.connect(this.musicGain);
    try{await this.customAudio.play();}catch(e){this.useForestMusic();throw e;}
  }
  useForestMusic(){if(this.customAudio){this.customAudio.pause();URL.revokeObjectURL(this.customAudio.src);this.customNode?.disconnect();this.customAudio=null;}this.nextNote=0;}
  get currentTrack(){return FOREST_SCORE[this.trackIndex].name;}
  nextTrack(){this.useForestMusic();this.trackIndex=(this.trackIndex+1)%FOREST_SCORE.length;this.trackRound=0;this.beat=0;this.nextNote=1.4;}
  note(midi,t,duration,volume){
    const c=this.ctx,f=440*Math.pow(2,(midi-69)/12);const g=c.createGain(),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1900;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+duration);g.connect(lp);lp.connect(this.musicGain);
    (this.instrument==='celeste'?[1,2.76,5.4]:[1,2,3]).forEach((h,i)=>{const o=c.createOscillator(),v=c.createGain();o.type='sine';o.frequency.value=f*h;v.gain.value=(this.instrument==='harp'?[1,.11,.02]:this.instrument==='celeste'?[1,.07,.012]:[1,.16,.035])[i];o.connect(v);v.connect(g);o.start(t);o.stop(t+duration+.04);o.onended=()=>{o.disconnect();v.disconnect();};});setTimeout(()=>{g.disconnect();lp.disconnect();},(duration+.1)*1000);
  }
  // Two phrases per piece, then a short breath before the next miniature.
  music(dt,night){
    if(!this.ok||this.customAudio)return;this.nextNote-=dt;if(this.nextNote>0)return;
    const track=FOREST_SCORE[this.trackIndex];this.nextNote+=track.step;this.instrument=track.voice;
    const b=this.beat++,t=this.ctx.currentTime,m=track.melody[b],duration=track.voice==='harp'?1.9:2.6;
    if(m)this.note(m-(night?12:0),t,duration,.085);
    const chord=track.chords[Math.floor(b/6)];if(b%3===0)this.note(chord[(b/3)%3|0],t,3.2,.065);if(b%6===0)chord.forEach((n,i)=>this.note(n+12,t+i*.09,3.8,.022));
    if(this.beat>=track.melody.length){this.beat=0;this.trackRound++;if(this.trackRound>=2){this.trackIndex=(this.trackIndex+1)%FOREST_SCORE.length;this.trackRound=0;this.nextNote+=2.6;}}
  }
}
