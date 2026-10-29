import * as THREE from 'three';

// Broad village lanes. The two services share their departure tangent so changing
// service at the station never turns the bus in place.
export const VILLAGE_LINES = [
 {name:'林间家园线',points:[[23,-9],[24,0],[17,7],[12,17],[12,25],[8,28],[-5,27],[-16,27],[-23,30],[-35,32],[-36,23],[-36,13],[-29,14],[-22,13],[-15,6],[-10,11],[2,12],[10,7],[12,-3],[17,-10],[17,-25],[12,-27],[7,-21],[13,-12],[19,-12]],stops:[{name:'龙猫车站',point:0},{name:'稻荷山道',point:2},{name:'树屋小院',point:5},{name:'听风亭',point:8},{name:'樱影町屋',point:10},{name:'古树桥头',point:14}]},
 {name:'星湖东岬线',points:[[23,-9],[24,0],[17,7],[10,7],[3,1],[1,-12],[-5,-23],[-2,-35],[-2,-41],[8,-40],[15,-34],[24,-36],[33,-35],[36,-24],[35,-9],[31,-4],[27,-2],[26,-7],[19,-12]],stops:[{name:'龙猫车站',point:0},{name:'稻荷山道',point:2},{name:'樟树神社',point:6},{name:'星湖入口',point:8},{name:'月光林地',point:9},{name:'东岬五重塔',point:12}]}
];

export const VILLAGE_CURVES=VILLAGE_LINES.map(line=>new THREE.CatmullRomCurve3(line.points.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal'));
const lanePoints=VILLAGE_CURVES.map(curve=>curve.getSpacedPoints(320));
// Spatial bins bound planting-time work, including the 38,000 meadow blades.
// Segments are indexed with a 12m margin; all lane reservations use <=8m.
const laneBins=new Map(),cell=8;
for(const points of lanePoints)for(let i=1;i<points.length;i++){
 const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,segment={x:a.x,z:a.z,dx,dz,inv:1/(dx*dx+dz*dz)};for(let x=Math.floor((Math.min(a.x,b.x)-12)/cell);x<=Math.floor((Math.max(a.x,b.x)+12)/cell);x++)for(let z=Math.floor((Math.min(a.z,b.z)-12)/cell);z<=Math.floor((Math.max(a.z,b.z)+12)/cell);z++){const key=x+':'+z;if(!laneBins.has(key))laneBins.set(key,[]);laneBins.get(key).push(segment);}
}
export function villageLaneDistance(x,z){let best=Infinity;for(const s of laneBins.get(Math.floor(x/cell)+':'+Math.floor(z/cell))||[]){const px=x-s.x,pz=z-s.z,t=Math.max(0,Math.min(1,(px*s.dx+pz*s.dz)*s.inv)),dx=px-t*s.dx,dz=pz-t*s.dz;best=Math.min(best,dx*dx+dz*dz);}return Math.sqrt(best);}
