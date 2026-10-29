// 原创奇幻生态：3款吉卜力风奇幻生物（森铃苔团·莫莫、乘风绒尾兽·噗噗、听雨笠蛙灵·滴答）
// 与 3款奇幻植物（风吟橡果灯笼木、晴雨呼吸伞菇群、泡泡水琴草）
import * as THREE from 'three';
import { loadGLB } from './asset-stream.js';
import { heightAt, LAYOUT } from './terrain.js';
import { colliders } from './world.js';

export const FANTASY_ASSET_FILES = [
  'assets/creature-momo.glb',
  'assets/creature-pupu.glb',
  'assets/creature-dida.glb',
  'assets/plant-acorn-lantern.glb',
  'assets/plant-weather-mushroom.glb',
  'assets/plant-melody-reed.glb',
];

function preparePrototype(sceneRoot, targetHeight) {
  const root = sceneRoot.clone(true);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = targetHeight / Math.max(0.01, size.y);

  const wrapper = new THREE.Group();
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  root.scale.setScalar(scale);
  wrapper.add(root);

  wrapper.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const clonedMats = mats.map((m) => {
      if (!m) return m;
      const c = m.clone();
      // Avoid expensive full-screen transmission pass when scene.environment is absent
      if ('transmission' in c && c.transmission > 0) {
        c.transmission = 0;
      }
      const mName = c.name || '';
      if (mName.includes('Bubble') || mName.includes('Dewdrop') || mName.includes('WaterPearl')) {
        c.transparent = true;
        c.opacity = mName.includes('Bubble') ? 0.72 : 0.86;
        c.roughness = 0.08;
        c.metalness = 0.05;
      } else if (mName.includes('BlueShroom') || mName.includes('BellCyan') || mName.includes('CrystalAmber')) {
        c.transparent = true;
        c.opacity = 0.92;
        c.roughness = 0.22;
      } else {
        c.metalness = 0;
      }
      return c;
    });
    o.material = Array.isArray(o.material) ? clonedMats : clonedMats[0];
  });

  return wrapper;
}

// Pick a random point inside a distant forest roam zone that avoids tree trunks
function pickForestWaypoint(cfg) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const r = (0.25 + 0.75 * Math.sqrt(Math.random())) * cfg.roamRadius;
    const tx = cfg.cx + Math.cos(a) * r;
    const tz = cfg.cz + Math.sin(a) * r;
    const blocked = colliders.some(
      (c) => c.type === 'circle' && c.top > 900 && Math.hypot(tx - c.x, tz - c.z) < c.r + 1.3
    );
    if (!blocked) {
      const gh = heightAt(tx, tz);
      const ty = gh + cfg.minHeight + Math.random() * (cfg.maxHeight - cfg.minHeight);
      return { x: tx, y: ty, z: tz };
    }
  }
  const gh = heightAt(cfg.cx, cfg.cz);
  return { x: cfg.cx, y: gh + cfg.minHeight + 0.6, z: cfg.cz };
}

export async function addFantasyEcology(scene) {
  const loaded = new Map(
    await Promise.all(
      FANTASY_ASSET_FILES.map(async (url) => [url, (await loadGLB(url)).scene])
    )
  );

  const group = new THREE.Group();
  group.name = '奇幻森林生态 · 原创生物与植物';
  scene.add(group);

  const protoMomo = preparePrototype(loaded.get('assets/creature-momo.glb'), 2.15);
  const protoPupu = preparePrototype(loaded.get('assets/creature-pupu.glb'), 1.52);
  const protoDida = preparePrototype(loaded.get('assets/creature-dida.glb'), 1.62);
  const protoAcornTree = preparePrototype(loaded.get('assets/plant-acorn-lantern.glb'), 3.35);
  const protoWeatherShroom = preparePrototype(loaded.get('assets/plant-weather-mushroom.glb'), 2.05);
  const protoMelodyReed = preparePrototype(loaded.get('assets/plant-melody-reed.glb'), 2.95);

  const momoInstances = [];
  const pupuInstances = [];
  const didaInstances = [];
  const acornTreeInstances = [];
  const shroomInstances = [];
  const reedInstances = [];

  // ---------------------------------------------------------------------------
  // 1. 森铃苔团 · 莫莫 (Creature 01: Moss-Bell Spirit "Momo") — 全图仅1只，置于远端静谧林间草地
  // ---------------------------------------------------------------------------
  const momoSpots = [
    { x: -16.5, z: 11.2, scale: 1.05, yaw: 0.65, label: '森铃苔团 · 莫莫' },
  ];
  for (const [idx, cfg] of momoSpots.entries()) {
    const inst = protoMomo.clone(true);
    const y = heightAt(cfg.x, cfg.z);
    inst.position.set(cfg.x, y, cfg.z);
    inst.rotation.y = cfg.yaw;
    inst.scale.setScalar(cfg.scale);
    inst.name = cfg.label;
    group.add(inst);
    colliders.push({ type: 'circle', x: cfg.x, z: cfg.z, r: 0.65 * cfg.scale, top: y + 1.9 * cfg.scale });

    const fernL = inst.getObjectByName('Momo_Fern_L');
    const fernR = inst.getObjectByName('Momo_Fern_R');
    const armL = inst.getObjectByName('Momo_Arm_L');
    const armR = inst.getObjectByName('Momo_Arm_R');
    const lantern = inst.getObjectByName('Momo_AcornLantern');
    momoInstances.push({
      root: inst,
      baseY: y,
      baseYaw: cfg.yaw,
      baseScale: cfg.scale,
      phase: idx * 2.1,
      hopT: 0,
      greetCD: 0,
      fernL,
      fernR,
      armL,
      armR,
      lanternMat: lantern?.material || null,
      headAnchor: () => new THREE.Vector3(inst.position.x, inst.position.y + 2.05 * cfg.scale, inst.position.z),
    });
  }

  // ---------------------------------------------------------------------------
  // 2. 乘风绒尾兽 · 噗噗 (Creature 02: Wind-Glider Squirrel-Fox "Pupu")
  //    放置在远处深林高冠层自由穿行，不追逐玩家，仅在玩家路过树下时在空中打招呼
  // ---------------------------------------------------------------------------
  const pupuSpots = [
    {
      cx: 26.5,
      cz: -17.5,
      roamRadius: 10.5,
      minHeight: 3.2,
      maxHeight: 5.0,
      scale: 0.9,
      speed: 2.6,
      label: '乘风绒尾兽 · 噗噗',
    },
    {
      cx: -21.5,
      cz: -28.5,
      roamRadius: 10.5,
      minHeight: 3.4,
      maxHeight: 5.2,
      scale: 0.88,
      speed: 2.5,
      label: '深林绒尾兽 · 噗噗',
    },
  ];
  for (const [idx, cfg] of pupuSpots.entries()) {
    const inst = protoPupu.clone(true);
    const startWp = pickForestWaypoint(cfg);
    inst.position.set(startWp.x, startWp.y, startWp.z);
    inst.scale.setScalar(cfg.scale);
    inst.name = cfg.label;
    group.add(inst);

    const nextWp = pickForestWaypoint(cfg);
    const wingL = inst.getObjectByName('Pupu_GinkgoWing_L');
    const wingR = inst.getObjectByName('Pupu_GinkgoWing_R');
    const armL = inst.getObjectByName('Pupu_Arm_L');
    const armR = inst.getObjectByName('Pupu_Arm_R');
    const core = inst.getObjectByName('Pupu_DandelionCore');
    const puff = inst.getObjectByName('Pupu_DandelionPuff');
    pupuInstances.push({
      root: inst,
      cfg,
      phase: idx * 3.14,
      hopT: 0,
      vel: new THREE.Vector3(0, 0, 1),
      waypoint: nextWp,
      wpTimer: 4.5,
      greetCD: 0,
      wingL,
      wingR,
      armL,
      armR,
      coreMat: core?.material || null,
      puffMat: puff?.material || null,
      headAnchor: () => new THREE.Vector3(inst.position.x, inst.position.y + 1.48 * cfg.scale, inst.position.z),
    });
  }

  // ---------------------------------------------------------------------------
  // 3. 听雨笠蛙灵 · 滴答 (Creature 03: Raindrop Lotus-Cap Frog "Dida")
  // ---------------------------------------------------------------------------
  const didaSpots = [
    { x: 5.1, z: 3.2, scale: 0.96, yaw: -0.85, label: '听雨笠蛙灵 · 滴答' },
    { x: -6.8, z: -47.2, scale: 0.96, yaw: 0.55, label: '星湖笠蛙灵 · 滴答' },
  ];
  for (const [idx, cfg] of didaSpots.entries()) {
    const inst = protoDida.clone(true);
    const y = heightAt(cfg.x, cfg.z);
    inst.position.set(cfg.x, y, cfg.z);
    inst.rotation.y = cfg.yaw;
    inst.scale.setScalar(cfg.scale);
    inst.name = cfg.label;
    group.add(inst);
    colliders.push({ type: 'circle', x: cfg.x, z: cfg.z, r: 0.54 * cfg.scale, top: y + 1.55 * cfg.scale });

    const parasol = inst.getObjectByName('Dida_LotusParasol');
    const blueShroom = inst.getObjectByName('Dida_BlueMushroomCap');
    const dewdrop = inst.getObjectByName('Dida_Dewdrop');
    const flute = inst.getObjectByName('Dida_Flute');
    didaInstances.push({
      root: inst,
      baseY: y,
      baseYaw: cfg.yaw,
      baseScale: cfg.scale,
      phase: idx * 1.9,
      hopT: 0,
      parasol,
      flute,
      shroomMat: blueShroom?.material || null,
      dewMat: dewdrop?.material || null,
      headAnchor: () => new THREE.Vector3(inst.position.x, inst.position.y + 1.72 * cfg.scale, inst.position.z),
    });
  }

  // ---------------------------------------------------------------------------
  // 4. 风吟橡果灯笼木 (Plant 01: Wind-Chime Acorn Lantern Shrub) — 散落排布于大地图林间与山道
  // ---------------------------------------------------------------------------
  const acornTreeSpots = [
    { x: -12.2, z: -13.2, scale: 1.05, yaw: 0.45, hasLight: true },
    { x: 19.5, z: 7.2, scale: 1.0, yaw: -0.65, hasLight: false },
    { x: -8.5, z: -31.0, scale: 1.02, yaw: 1.15, hasLight: false },
  ];
  for (const [idx, cfg] of acornTreeSpots.entries()) {
    const inst = protoAcornTree.clone(true);
    const y = heightAt(cfg.x, cfg.z) - 0.05;
    inst.position.set(cfg.x, y, cfg.z);
    inst.rotation.y = cfg.yaw;
    inst.scale.setScalar(cfg.scale);
    inst.name = '风吟橡果灯笼木';
    group.add(inst);
    colliders.push({ type: 'circle', x: cfg.x, z: cfg.z, r: 0.78 * cfg.scale, top: y + 2.6 * cfg.scale });

    const pinwheels = [];
    const crystals = [];
    inst.traverse((o) => {
      if (o.name.startsWith('AcornTree_Pinwheel_')) pinwheels.push(o);
      if (o.name.endsWith('_Crystal') && o.material) crystals.push(o);
    });
    let pointLight = null;
    if (cfg.hasLight) {
      pointLight = new THREE.PointLight('#ffbe55', 0.85, 10, 1.5);
      pointLight.position.set(cfg.x, y + 2.0, cfg.z);
      group.add(pointLight);
    }
    acornTreeInstances.push({ root: inst, pinwheels, crystals, pointLight, phase: idx * 1.7 });
  }

  // ---------------------------------------------------------------------------
  // 5. 晴雨呼吸伞菇群 (Plant 02: Weather-Breathing Parasol Mushrooms)
  //    第1处加长改造为横跨云冠古树环形宽溪的可通行「古树苔木桥」，其余散落远端林间
  // ---------------------------------------------------------------------------
  const shroomSpots = [
    { x: -19.8, z: 0.0, scale: 1.0, yaw: 0.0, isBridge: true },
    { x: -4.8, z: -9.8, scale: 1.0, yaw: 0.35, isBridge: false },
    { x: 16.5, z: 24.5, scale: 0.96, yaw: -0.8, isBridge: false },
  ];
  const origShroomXZ = [
    [-0.82, 0.08],
    [-0.46, -0.06],
    [-0.26, 0.14],
    [0.16, -0.08],
    [0.56, 0.12],
    [0.84, -0.06],
  ];
  const bridgeShroomTargetXZ = [
    [-1.85, 1.02],
    [-0.15, 1.05],
    [1.65, 1.02],
    [-1.55, -1.02],
    [0.20, -1.05],
    [1.85, -1.02],
  ];

  for (const [idx, cfg] of shroomSpots.entries()) {
    const inst = protoWeatherShroom.clone(true);
    const y = heightAt(cfg.x, cfg.z) - (cfg.isBridge ? 0.18 : 0.05);
    inst.position.set(cfg.x, y, cfg.z);
    inst.rotation.y = cfg.yaw;
    inst.scale.setScalar(cfg.scale);
    inst.name = cfg.isBridge ? '古树苔木桥 · 晴雨呼吸伞菇' : '晴雨呼吸伞菇群';

    if (cfg.isBridge) {
      // 将倒木与青苔毯加长加宽为横跨环河的可行走树桥，并将6朵呼吸伞菇移至树桥南北两侧护栏边
      const logMesh = inst.getObjectByName('Shroom_FallenLog');
      const mossMesh = inst.getObjectByName('Shroom_LogMoss');
      if (logMesh) {
        logMesh.rotation.set(0, 0, -Math.PI / 2);
        logMesh.scale.set(0.52, 3.25, 3.35);
        logMesh.position.set(0, 0.05, 0);
      }
      if (mossMesh) {
        mossMesh.scale.set(3.35, 0.55, 3.1);
        mossMesh.position.set(0, 0.14, 0);
      }
      for (let k = 0; k < 6; k++) {
        const dx = bridgeShroomTargetXZ[k][0] - origShroomXZ[k][0];
        const dz = bridgeShroomTargetXZ[k][1] - origShroomXZ[k][1];
        const dy = -0.22;
        for (const prefix of ['Shroom_Cap_', 'Shroom_CoralCrown_', 'Shroom_Skirt_', 'Shroom_Stem_']) {
          const part = inst.getObjectByName(prefix + k);
          if (part) {
            part.position.x += dx;
            part.position.y += dy;
            part.position.z += dz;
          }
        }
        for (let pIdx = 0; pIdx < 3; pIdx++) {
          const wp = inst.getObjectByName(`Shroom_WaterPearl_${k}_${pIdx}`);
          if (wp) {
            wp.position.x += dx;
            wp.position.y += dy;
            wp.position.z += dz;
          }
        }
      }
    } else {
      colliders.push({ type: 'circle', x: cfg.x, z: cfg.z, r: 0.82 * cfg.scale, top: y + 1.5 * cfg.scale });
    }

    group.add(inst);

    const morphCaps = [];
    const waterPearls = [];
    inst.traverse((o) => {
      if (o.isMesh && o.name.startsWith('Shroom_Cap_') && o.morphTargetInfluences) {
        const capIdx = Number(o.name.split('_').pop()) || 0;
        morphCaps.push({ mesh: o, capIdx });
      }
      if (o.isMesh && o.name.startsWith('Shroom_WaterPearl_')) {
        waterPearls.push({ mesh: o, baseY: o.position.y, phase: waterPearls.length * 1.1 });
      }
    });
    shroomInstances.push({ root: inst, morphCaps, waterPearls, phase: idx * 2.0 });
  }

  // ---------------------------------------------------------------------------
  // 6. 泡泡水琴草 (Plant 03: Melody Bubble-Harp Reed) — 池塘仅保留1株且体积更大，另1株远在北方星湖
  // ---------------------------------------------------------------------------
  const reedSpots = [
    { x: 9.3, z: 6.9, y: -0.19, scale: 1.08, yaw: -0.75 },
    { x: -1.85, z: -48.5, y: LAYOUT.lake.level + 0.02, scale: 1.12, yaw: 0.35 },
  ];
  for (const [idx, cfg] of reedSpots.entries()) {
    const inst = protoMelodyReed.clone(true);
    inst.position.set(cfg.x, cfg.y, cfg.z);
    inst.rotation.y = cfg.yaw;
    inst.scale.setScalar(cfg.scale);
    inst.name = '泡泡水琴草';
    group.add(inst);

    const bubbles = [];
    const bells = [];
    const spores = [];
    inst.traverse((o) => {
      if (o.isMesh && o.name.startsWith('Reed_Bubble_')) {
        bubbles.push({ mesh: o, baseY: o.position.y, baseScale: o.scale.x, phase: bubbles.length * 0.85 });
      }
      if (o.isMesh && o.name.startsWith('Reed_BellFlower_')) {
        bells.push({ mesh: o, baseRotZ: o.rotation.z, phase: bells.length * 1.3 });
      }
      if (o.isMesh && o.name.startsWith('Reed_Spore_')) {
        spores.push({ mesh: o, baseY: o.position.y, phase: spores.length * 0.7 });
      }
    });
    reedInstances.push({ root: inst, bubbles, bells, spores, phase: idx * 1.5, chimeCD: 0 });
  }

  const PUPU_GREET_LINES = [
    '噗噗～看我在树冠间乘风滑翔！见到你真开心 🍃',
    '呼呼～你路过树林的风声，我老远就听见啦 🌼',
    '毛茸茸的蒲公英大尾巴在发光，祝你散步愉快 ✨',
  ];

  return {
    group,
    momoInstances,
    pupuInstances,
    didaInstances,
    acornTreeInstances,
    shroomInstances,
    reedInstances,

    onGreet(playerPos, say, sound) {
      for (const m of momoInstances) {
        if (Math.hypot(playerPos.x - m.root.position.x, playerPos.z - m.root.position.z) < 4.5) {
          m.hopT = 0.65;
          sound?.chime?.(3);
          const lines = [
            '莫莫～尾巴上的金橡果在发光呢 🌰',
            '叮铃铃～微风吹得头顶的蕨芽好痒呀 🌱',
            '呼噜～这片安静的西林草地晒太阳最舒服啦 ☀️',
          ];
          say?.(lines[Math.floor(Math.random() * lines.length)], m.headAnchor, 2.4, true);
          return true;
        }
      }
      for (const p of pupuInstances) {
        if (Math.hypot(playerPos.x - p.root.position.x, playerPos.z - p.root.position.z) < 8.5) {
          p.hopT = 0.75;
          sound?.chime?.(5);
          say?.(PUPU_GREET_LINES[Math.floor(Math.random() * PUPU_GREET_LINES.length)], p.headAnchor, 2.5, true);
          return true;
        }
      }
      for (const d of didaInstances) {
        if (Math.hypot(playerPos.x - d.root.position.x, playerPos.z - d.root.position.z) < 4.5) {
          d.hopT = 0.65;
          sound?.chime?.(7);
          const lines = [
            '呱呜～听见池塘边吹响的竹笛声了吗 🎵',
            '滴答滴答～头顶的蓝伞菇与露珠灯笼在夜里会更亮哦 💧',
          ];
          say?.(lines[Math.floor(Math.random() * lines.length)], d.headAnchor, 2.4, true);
          return true;
        }
      }
      return false;
    },

    update(dt, elapsed, playerPos, env, roarGust = 0, say = null, sound = null) {
      const night = env?.night || 0;
      const rain = env?.rain || 0;
      const windBoost = 1 + roarGust * 3.5;

      // 1. Update Momo
      for (const m of momoInstances) {
        const t = elapsed + m.phase;
        m.hopT = Math.max(0, m.hopT - dt);
        m.greetCD = Math.max(0, m.greetCD - dt);
        const hopOffset = m.hopT > 0 ? Math.sin((m.hopT / 0.65) * Math.PI) * 0.42 : 0;
        m.root.position.y = m.baseY + hopOffset + Math.abs(Math.sin(t * 2.1)) * 0.03;

        const breath = 1 + Math.sin(t * 2.1) * 0.025;
        m.root.scale.set(m.baseScale * (2 - breath), m.baseScale * breath, m.baseScale * (2 - breath));
        m.root.rotation.z = Math.sin(t * 1.4) * 0.035;

        const dx = playerPos.x - m.root.position.x;
        const dz = playerPos.z - m.root.position.z;
        const dist = Math.hypot(dx, dz);
        const targetYaw = dist < 6.5 ? Math.atan2(dx, dz) : m.baseYaw + Math.sin(t * 0.4) * 0.25;
        let dy = targetYaw - m.root.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        m.root.rotation.y += dy * Math.min(1, dt * 3.0);

        if (m.fernL) m.fernL.rotation.z = Math.sin(t * 3.2) * 0.08 * windBoost;
        if (m.fernR) m.fernR.rotation.z = -Math.sin(t * 3.2 + 0.6) * 0.08 * windBoost;
        if (m.lanternMat) {
          m.lanternMat.emissiveIntensity = 1.2 + night * 2.4 + Math.sin(t * 3.8) * 0.35 + (dist < 4 ? 0.8 : 0);
        }
      }

      // 2. Update Pupu (free random high-canopy flight in distant forest; greets from canopy without chasing player)
      for (const p of pupuInstances) {
        p.hopT = Math.max(0, p.hopT - dt);
        p.greetCD = Math.max(0, p.greetCD - dt);

        const pos = p.root.position;
        const distToPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);

        // When player walks nearby under the forest canopy, greet happily in place without chasing!
        if (distToPlayer < 6.5 && p.greetCD <= 0) {
          p.greetCD = 16.0;
          p.hopT = 0.75;
          sound?.chime?.(5);
          say?.(
            PUPU_GREET_LINES[Math.floor(Math.random() * PUPU_GREET_LINES.length)],
            p.headAnchor,
            2.6,
            true
          );
        }

        p.wpTimer -= dt;
        const distWp = Math.hypot(p.waypoint.x - pos.x, p.waypoint.z - pos.z);
        if (distWp < 1.6 || p.wpTimer <= 0) {
          p.waypoint = pickForestWaypoint(p.cfg);
          p.wpTimer = 3.5 + Math.random() * 4.0;
        }
        const targetX = p.waypoint.x;
        const targetZ = p.waypoint.z;
        const gh = heightAt(pos.x, pos.z);
        const waveY = Math.sin(elapsed * 1.8 + p.phase) * 0.45;
        const targetY = Math.max(gh + p.cfg.minHeight, p.waypoint.y + waveY);

        const desired = new THREE.Vector3(targetX - pos.x, targetY - pos.y, targetZ - pos.z);
        const distTarget = desired.length();
        if (distTarget > 0.001) {
          desired.divideScalar(distTarget).multiplyScalar(p.cfg.speed);
        }

        // Soft repulsion from tree trunks so Pupu weaves around trees naturally
        for (const c of colliders) {
          if (c.type === 'circle' && c.top > 900) {
            const dx = pos.x - c.x;
            const dz = pos.z - c.z;
            const d = Math.hypot(dx, dz);
            const avoidR = c.r + 1.5;
            if (d > 0.01 && d < avoidR) {
              const push = ((avoidR - d) / avoidR) * 3.5;
              desired.x += (dx / d) * push;
              desired.z += (dz / d) * push;
            }
          }
        }

        p.vel.lerp(desired, Math.min(1, dt * 3.0));
        pos.addScaledVector(p.vel, dt);

        const twirlY = p.hopT > 0 ? Math.sin((p.hopT / 0.75) * Math.PI) * 0.45 : 0;
        pos.y += twirlY * dt * 2.5;

        const desiredYaw = Math.atan2(p.vel.x, p.vel.z);
        let dYaw = desiredYaw - p.root.rotation.y;
        dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
        p.root.rotation.y += dYaw * Math.min(1, dt * 4.5) + (p.hopT > 0 ? dt * Math.PI * 2.6 : 0);
        p.root.rotation.z = THREE.MathUtils.clamp(-dYaw * 0.35, -0.35, 0.35);
        p.root.rotation.x = THREE.MathUtils.clamp(-p.vel.y * 0.12, -0.28, 0.28);

        const flap = Math.sin(elapsed * 5.4 + p.phase) * 0.22 * windBoost;
        if (p.wingL) p.wingL.rotation.y = flap;
        if (p.wingR) p.wingR.rotation.y = -flap;
        if (p.coreMat) p.coreMat.emissiveIntensity = 1.0 + night * 2.0 + Math.sin(elapsed * 3.0) * 0.25;
      }

      // 3. Update Dida (flute playing & rain/night bioluminescence)
      for (const d of didaInstances) {
        const t = elapsed + d.phase;
        d.hopT = Math.max(0, d.hopT - dt);
        const hopY = d.hopT > 0 ? Math.sin((d.hopT / 0.65) * Math.PI) * 0.35 : 0;
        d.root.position.y = d.baseY + hopY;

        const sway = Math.sin(t * 2.8) * 0.055;
        d.root.rotation.z = sway;
        const breath = 1 + Math.sin(t * 2.8 * 2) * 0.02;
        d.root.scale.set(d.baseScale, d.baseScale * breath, d.baseScale);

        const dx = playerPos.x - d.root.position.x;
        const dz = playerPos.z - d.root.position.z;
        const dist = Math.hypot(dx, dz);
        const targetYaw = dist < 5.5 ? Math.atan2(dx, dz) : d.baseYaw + Math.sin(t * 0.5) * 0.2;
        let dy = targetYaw - d.root.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        d.root.rotation.y += dy * Math.min(1, dt * 2.8);

        const glowAmt = 0.8 + night * 2.2 + rain * 1.5 + Math.sin(t * 4.0) * 0.25;
        if (d.shroomMat) d.shroomMat.emissiveIntensity = glowAmt * 0.85;
        if (d.dewMat) d.dewMat.emissiveIntensity = glowAmt * 1.25;
      }

      // 4. Update Acorn Lantern Shrubs (spinning pinwheel leaves & glowing crystal acorns)
      for (const at of acornTreeInstances) {
        const t = elapsed + at.phase;
        for (const [i, pw] of at.pinwheels.entries()) {
          pw.rotation.y += dt * (1.8 + (i % 3) * 0.4) * windBoost;
        }
        for (const [i, cr] of at.crystals.entries()) {
          cr.material.emissiveIntensity = 1.1 + night * 2.5 + Math.sin(t * 2.5 + i) * 0.3;
        }
        if (at.pointLight) {
          at.pointLight.intensity = 0.35 + night * 2.6 + rain * 0.8;
        }
      }

      // 5. Update Weather-Breathing Parasol Mushrooms (BlendShapeSunny_Folded <-> Rainy_Open)
      for (const sh of shroomInstances) {
        const t = elapsed + sh.phase;
        for (const { mesh, capIdx } of sh.morphCaps) {
          const baseOpen = capIdx >= 3 ? 0.82 : 0.08;
          const breath = Math.sin(t * 1.8 + capIdx * 0.7) * 0.08;
          const targetMorph = THREE.MathUtils.clamp(THREE.MathUtils.lerp(baseOpen + breath, 1.0, rain), 0, 1);
          mesh.morphTargetInfluences[0] = targetMorph;
        }
        for (const wp of sh.waterPearls) {
          wp.mesh.position.y = wp.baseY + Math.sin(t * 2.6 + wp.phase) * 0.045 + rain * 0.06;
          if (wp.mesh.material) {
            wp.mesh.material.emissiveIntensity = 0.9 + night * 1.8 + rain * 1.4;
          }
        }
      }

      // 6. Update Melody Bubble-Harp Reeds (floating iridescent bubbles & glowing cyan bell-flowers)
      for (const rd of reedInstances) {
        const t = elapsed + rd.phase;
        rd.chimeCD = Math.max(0, rd.chimeCD - dt);
        const dist = Math.hypot(playerPos.x - rd.root.position.x, playerPos.z - rd.root.position.z);
        const nearBoost = dist < 3.5 ? 2.2 : 1.0;

        for (const b of rd.bubbles) {
          b.mesh.position.y = b.baseY + Math.sin(t * 2.0 * nearBoost + b.phase) * 0.035;
          const pulse = b.baseScale * (1 + Math.sin(t * 3.1 + b.phase) * 0.06 * nearBoost);
          b.mesh.scale.setScalar(pulse);
        }
        for (const bl of rd.bells) {
          bl.mesh.rotation.z = bl.baseRotZ + Math.sin(t * 2.2 * windBoost + bl.phase) * 0.08;
          if (bl.mesh.material) {
            bl.mesh.material.emissiveIntensity = 1.0 + night * 2.2 + Math.sin(t * 3.4 + bl.phase) * 0.3;
          }
        }
        for (const sp of rd.spores) {
          sp.mesh.position.y = sp.baseY + ((t * 0.12 + sp.phase) % 0.18);
        }
      }
    },
  };
}
