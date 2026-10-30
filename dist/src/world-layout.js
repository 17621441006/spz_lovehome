// Shared world planning: one focal landmark per clearing, joined by quiet paths.
// Coordinates live here so terrain, dressing, navigation and labels stay together.
export const LAYOUT = {
 spawn:{x:0,z:6}, meadow:{x:0,z:5,rx:13,rz:12},
 roadX:18, bus:{x:22,z:-13}, totoro:{x:26,z:-18},
 camphor:{x:-14,z:-16}, house:{x:0,z:38}, pond:{x:34,z:6,r:3.3},
 lake:{x:-4,z:-60,r:11.5,level:-.32},lakeLobe:21,lakeLobeWidth:.43,
 sprout:{x:-5,z:-20},playRadius:62,terrainRadius:67,treeLimit:60,
 elder:{x:-28,z:0,flat:10.5,blend:14},catbusRoute:{x:22,z:-23,rx:8,rz:11},
 dewGlade:{x:16,z:-48,rx:4.1,rz:5.2,home:{x:16,z:-46},dew:[[16,-48],[18,-49],[18,-51],[15,-51],[14.5,-49]]},
 inari:{x:23,z:11,endZ:35.8},
 buildings:[
  {id:'shrine',name:'风起草甸 · 听风亭',x:-27,z:39,width:6*Math.SQRT2,flat:6.3,rotation:Math.PI},
  {id:'pagoda',name:'东岬五重塔',x:42,z:-30,width:5.7,flat:5.2,rotation:-Math.PI/2},
  {id:'temple',name:'山顶朱红寺院',x:23,z:40,width:11.6,flat:7.1,rotation:Math.PI},
  {id:'japanese-house',name:'樱影町屋',x:-43,z:20,width:6,flat:6.4,rotation:Math.PI/2},
 ],
};

export const WALK_PATHS=[
 {id:'elder',name:'云冠古树',points:[[0,6],[-6,4],[-11,1],[-16.8,0]],width:1.35},
 {id:'lake',name:'星湖钓场',points:[[0,6],[1,-3],[-2,-10],[-5,-23],[-3,-34],[-3.2,-46]],width:1.3},
 {id:'camphor',name:'樟树神社',points:[[1,-3],[-4,-3],[-6.68,-5.296],[-8.6,-7.6],[-10.52,-9.904],[-12.4,-10.3]],width:.85},
 {id:'house',name:'树屋小院',points:[[0,6],[2,15],[0,24],[0,31.5]],width:1.35},
 {id:'temple',name:'稻荷山道',points:[[0,6],[9,8],[17,7],[23,11],[23,35.8]],width:1.25},
 {id:'station',name:'龙猫车站',points:[[9,8],[14,0],[18.5,-8],[22,-12],[24,-14]],width:1.15},
 {id:'pond',name:'水琴湿地',points:[[23,8.8],[28,8.8],[30,6]],width:.9},
 {id:'pavilion',name:'听风亭',points:[[0,24],[-10,27],[-20,30],[-27,32.7]],width:1.15},
 {id:'town',name:'樱影町屋',points:[[-16.8,0],[-18,8],[-25,13],[-35,16],[-37.5,20]],width:1.2},
 {id:'west',name:'风起草甸',points:[[-37.5,20],[-36,29],[-27,32.7]],width:.9},
 {id:'pagoda',name:'东岬五重塔',points:[[22,-12],[32,-12],[35,-22],[37.3,-30]],width:1.15},
 {id:'dew',name:'露灯小径',points:[[8,-40],[11.5,-43.3],[14,-44],[16,-46]],width:.72},
 {id:'dew-loop',name:'晨露草隙',points:[[16,-46],[16,-48],[18,-49],[18,-51],[15,-51],[14.5,-49],[16,-46]],width:.45},
 {id:'fern-loop',name:'蕨谷回环',points:[[-5,-23],[-12,-25],[-20,-27],[-27,-24],[-33,-25],[-36,-21],[-30,-17],[-28,-17],[-26,-20.5],[-20,-21],[-16,-21],[-12,-23],[-5,-23]],width:.72},
 {id:'moon-wood',name:'月光林间',points:[[-3,-34],[3,-34],[8,-34.5],[11,-37],[13,-39],[11.5,-43.3]],width:.72},
];

export function centralMeadow(x,z,pad=0){const c=LAYOUT.meadow;return ((x-c.x)/(c.rx+pad))**2+((z-c.z)/(c.rz+pad))**2<1;}
export const FOREST_REGIONS=[{x:-31,z:-25,rx:16,rz:14},{x:12,z:-39,rx:14,rz:12}];
export function forestDepth(x,z){let value=0;for(const f of FOREST_REGIONS){const d=Math.hypot((x-f.x)/f.rx,(z-f.z)/f.rz),t=Math.max(0,Math.min(1,(1.2-d)/.55));value=Math.max(value,t*t*(3-2*t));}return value;}
export function focalClearing(x,z,pad=0){
 if(centralMeadow(x,z,pad))return true;
 const d=LAYOUT.dewGlade;if(((x-d.x)/(d.rx+pad))**2+((z-d.z)/(d.rz+pad))**2<1)return true;
 if(Math.hypot(x-LAYOUT.house.x,z-LAYOUT.house.z)<9+pad)return true;
 if(Math.hypot(x-LAYOUT.totoro.x,z-LAYOUT.totoro.z)<6+pad)return true;
 return LAYOUT.buildings.some(b=>Math.hypot(x-b.x,z-b.z)<b.flat+3+pad);
}
export function regionDescription(x,z){
 if(Math.hypot(x+34,z+22)<7)return '蕨谷 · 月袋把一小弯月光藏在林荫里';
 if(Math.hypot(x-LAYOUT.dewGlade.x,z-LAYOUT.dewGlade.z)<8)return '露灯小径 · 跟着暖光，帮灯尾茸寻找晨露';
 if(Math.hypot(x-LAYOUT.lake.x,z-LAYOUT.lake.z)<26)return '星湖 · 芦苇、木栈桥与阿渔伯的钓场';
 if(Math.hypot(x-LAYOUT.elder.x,z-LAYOUT.elder.z)<13)return '云冠古树 · 过溪入树洞，沿光环去树顶';
 if(Math.hypot(x-26,z+18)<10)return '龙猫车站 · 古木睡窝，等一班森林的车';
 if(Math.hypot(x-34,z-6)<9)return '水琴湿地 · 睡莲、蛙灵与水声';
 if(Math.hypot(x,z-38)<12)return '树屋小院 · 林间的家与煤球伙伴';
 if(x>17&&z>13)return '稻荷山道 · 沿石阶去山顶朱红寺院';
 if(Math.hypot(x-42,z+30)<13)return '东岬五重塔与远处的海';
 if(Math.hypot(x+43,z-20)<12)return '樱影町屋 · 林带与淡粉樱花';
 if(Math.hypot(x+27,z-39)<13)return '风起草甸 · 听风亭与开阔的草坡';
 if(Math.hypot(x+14,z+16)<9)return '樟树神社 · 旧鸟居下的安静林荫';
 if(centralMeadow(x,z,3))return '初晴草甸 · 北去星湖，西寻古树，南回树屋';
 if(Math.hypot(x,z)>56)return '云海崖畔 · 远处只有海与风';
 return '林间小径 · 沿着苔石和小路，发现下一片风景';
}
