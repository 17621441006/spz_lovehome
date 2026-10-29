// Headless balance check for the fishing fight (no GPU): runs the real fightStep with stubbed HUD.
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { FishingGame, FISH } = await import('../dist/src/minigames/fishing.js');
const THREE = await import('three');
const stub = () => ({ style: {}, classList: { toggle() {}, add() {}, remove() {} }, textContent: '', hidden: false, offsetWidth: 0 });
function run(def, policy, seed) {
  const g = new FishingGame({ scene: { add() {}, remove() {} }, camera: new THREE.PerspectiveCamera() });
  g.el = new Proxy({}, { get: (o, k) => (o[k] ||= stub()) });
  g.session = { caught: [], kept: 0, lost: 0 }; g.time = 0; g.aim = 0;
  g.alert = () => {}; g.hint = () => {}; g.splash = () => {}; g.ripple = () => {}; g.plop = () => {}; g.tone = () => {}; g.snapSound = () => {};
  g.species = def; g.bobberPos = new THREE.Vector3(g.spot.x, -0.4, g.spot.z - 12);
  g.down = false; g.state = 'bite';
  const realBuild = g.build; g.fish = null;
  // hook() without meshes
  g.hook = FishingGame.prototype.hook; g.scene = { add() {}, remove() {} };
  g.hook();
  let t = 0, reason = 'timeout';
  g.lose = (txt, r) => { reason = r; g.state = 'lost'; };
  g.land = () => { reason = 'caught'; g.state = 'landed'; g.landFrom = new THREE.Vector3(); };
  while (t < 90 && g.state === 'fight') { const dt = 1 / 60; t += dt; g.time = t; policy(g, dt); g.fightStep(dt); }
  return { reason, t: +t.toFixed(1) };
}
const bot = (g) => { const fs = g.fs; g.aim = fs.swim; g.down = fs.mode === 'jump' ? false : g.tension < 0.72; };
let naiveHold = true;
const naive = (g) => { const fs = g.fs; g.aim = 0; if (g.tension > 0.9) naiveHold = false; if (g.tension < 0.45) naiveHold = true; g.down = naiveHold && fs.mode !== 'jump'; };
const holder = (g) => { g.aim = 0; g.down = true; };
for (const def of FISH) {
  const res = { bot: [], naive: [], holder: [] };
  for (let i = 0; i < 12; i++) { res.bot.push(run(def, bot)); res.naive.push(run(def, naive)); res.holder.push(run(def, holder)); }
  const sum = (a) => `${a.filter((r) => r.reason === 'caught').length}/12 caught, avg ${(a.reduce((s, r) => s + r.t, 0) / a.length).toFixed(1)}s, fails: ${[...new Set(a.filter((r) => r.reason !== 'caught').map((r) => r.reason))].join(',')}`;
  console.log(def.id.padEnd(10), '| bot', sum(res.bot), '| naive', sum(res.naive), '| holdAll', sum(res.holder));
}
