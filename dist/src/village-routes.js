import * as THREE from 'three';

// Broad village lanes. The two services share their departure tangent so changing
// service at the station never turns the bus in place.
export const VILLAGE_LINES = [
 {name:'村庄漫游线',points:[[23,-7],[24,1],[16,8],[7,15],[-1,11],[-10,8],[-15,4],[-25,13],[-33,17],[-33,28],[-23,32],[-13,31],[-2,28],[6,27],[15,25],[17,17],[19,5],[28,5],[34,12],[36,18],[39,12],[35,2],[30,-17],[24,-27],[14,-29],[7,-22],[12,-14],[19,-15]],stops:[{name:'龙猫车站',point:0},{name:'稻荷山道',point:2},{name:'古树桥头',point:6},{name:'林间町屋',point:7},{name:'风起草甸',point:10},{name:'树屋小院',point:12},{name:'朱红寺院',point:13},{name:'五重塔',point:19}]},
 {name:'星湖森林线',points:[[23,-7],[24,1],[16,8],[7,15],[-1,11],[-2,3],[1.5,-11],[-5,-17],[-1,-29],[-2,-41],[8,-40],[10,-30],[8,-22],[12,-14],[19,-15]],stops:[{name:'龙猫车站',point:0},{name:'稻荷山道',point:2},{name:'树屋小院',point:3},{name:'樟树神社',point:7},{name:'星湖入口',point:9},{name:'月光林地',point:10}]}
];

export const VILLAGE_CURVES=VILLAGE_LINES.map(line=>new THREE.CatmullRomCurve3(line.points.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal'));
const lanePoints=VILLAGE_CURVES.map(curve=>curve.getSpacedPoints(320));
// Spatial bins bound planting-time work, including the 38,000 meadow blades.
// Segments are indexed with a 12m margin; all lane reservations use <=8m.
const laneBins=new Map(),cell=8;
for(const points of lanePoints)for(let i=1;i<points.length;i++){
 const a=points[i-1],b=points[i];for(let x=Math.floor((Math.min(a.x,b.x)-12)/cell);x<=Math.floor((Math.max(a.x,b.x)+12)/cell);x++)for(let z=Math.floor((Math.min(a.z,b.z)-12)/cell);z<=Math.floor((Math.max(a.z,b.z)+12)/cell);z++){const key=x+':'+z;if(!laneBins.has(key))laneBins.set(key,[]);laneBins.get(key).push([a,b]);}
}
export function villageLaneDistance(x,z){let best=Infinity;for(const [a,b]of laneBins.get(Math.floor(x/cell)+':'+Math.floor(z/cell))||[]){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));best=Math.min(best,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));}return best;}
