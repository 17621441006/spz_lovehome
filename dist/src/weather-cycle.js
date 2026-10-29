export class WeatherCycle{
 constructor(random=Math.random){this.random=random;this.auto=true;this.remaining=180;}
 manual(){this.auto=false;}
 resume(){this.auto=true;this.remaining=120;}
 update(dt,current){if(!this.auto)return null;this.remaining-=dt;if(this.remaining>0)return null;this.remaining=180+this.random()*120;const table=[['sun',.43],['snow',.37],['rain',.10],['cloud',.06],['night',.04]].filter(([k])=>k!==current),total=table.reduce((s,x)=>s+x[1],0);let r=this.random()*total;for(const [type,w]of table){r-=w;if(r<=0)return type;}return 'sun';}
}
