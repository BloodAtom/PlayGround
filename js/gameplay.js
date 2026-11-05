/* ============================================================================
   gameplay: player, combat, enemies, pickups, particles
   ============================================================================ */

let lastHitSfx = 0;

function createPlayer(weaponIndex) {
  const p = {
    x: ARENA.w / 2, y: ARENA.h / 2 + 60, r: 17,
    speed: 248, damageMult: 1, speedMult: 1, fireRateMult: 1,
    rangeMult: 1, xpMult: 1, magnet: 122,
    maxHearts: 5, hearts: 5, hitsPerHeart: 2, hits: 2,
    invuln: 0, superTimer: 0, muzzle: 0, hurtFlash: 0,
    aim: -Math.PI / 2, moveAngle: -Math.PI / 2, moving: false, walkT: 0,
    dead: false, weapon: weaponIndex, weapons: [],
    skills: {}, fusion: false, doubleShot: false, cigar: false,
    coin: 0
  };
  WEAPONS.forEach((def, i) => {
    p.weapons.push({
      unlocked: i === weaponIndex,
      ammo: def.ammo,
      reloading: false,
      reloadT: 0,
      fireT: 0
    });
  });
  return p;
}

/* --------------------------------------------------------------- combat */
function findNearestEnemy(maxRange) {
  const p = G.player;
  let best = null, bestD = maxRange === undefined ? Infinity : maxRange;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = dist(p.x, p.y, e.x, e.y) - e.r;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function updateMovement(dt) {
  const p = G.player;
  let mx = 0, my = 0;
  const k = input.keys;
  if (k.has('a') || k.has('arrowleft')) mx -= 1;
  if (k.has('d') || k.has('arrowright')) mx += 1;
  if (k.has('w') || k.has('arrowup')) my -= 1;
  if (k.has('s') || k.has('arrowdown')) my += 1;
  mx += input.joy.x;
  my += input.joy.y;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  p.moving = len > 0.08;
  if (p.moving) {
    p.x += mx * p.speed * p.speedMult * dt;
    p.y += my * p.speed * p.speedMult * dt;
    p.moveAngle = Math.atan2(my, mx);
    p.walkT += dt * (5 + Math.hypot(mx, my) * 5);
    if (Math.random() < dt * 8) {
      spawnParticles(p.x - mx * 12, p.y + 10, 'rgba(160,150,130,0.28)', 1, 12, 0.35, 3);
    }
  }
  p.x = clamp(p.x, ARENA.pad, ARENA.w - ARENA.pad);
  p.y = clamp(p.y, ARENA.pad, ARENA.h - ARENA.pad);
}

function updateWeapons(dt) {
  const p = G.player;
  for (let i = 0; i < p.weapons.length; i++) {
    const ws = p.weapons[i];
    const def = WEAPONS[i];
    if (ws.fireT > 0) ws.fireT = Math.max(0, ws.fireT - dt);
    if (ws.reloading) {
      ws.reloadT -= dt;
      if (ws.reloadT <= 0) {
        ws.reloading = false;
        ws.ammo = def.ammo;
        if (i === p.weapon) { audio.sfx('reload'); }
      }
    }
  }
}

function startReload() {
  const p = G.player;
  const ws = p.weapons[p.weapon];
  const def = WEAPONS[p.weapon];
  if (ws.reloading || ws.ammo >= def.ammo) return;
  ws.reloading = true;
  ws.reloadT = def.reload;
  audio.sfx('reload');
}

function switchWeapon(i) {
  const p = G.player;
  if (!p || !p.weapons[i] || !p.weapons[i].unlocked) return;
  if (p.weapon === i) return;
  p.weapon = i;
  p.weapons[i].fireT = Math.max(p.weapons[i].fireT, 0.14);
  buildWeaponBar();
  updateWeaponBar();
  audio.sfx('reload');
}

function autoAimAndFire(dt) {
  const p = G.player;
  const def = WEAPONS[p.weapon];
  const ws = p.weapons[p.weapon];
  const target = findNearestEnemy(def.range * p.rangeMult);
  if (target) {
    p.aim = angleTo(p.x, p.y, target.x, target.y);
  } else if (p.moving) {
    p.aim = p.moveAngle;
  }
  if (!target) return;
  if (ws.reloading || ws.ammo <= 0 || ws.fireT > 0) return;
  fireWeapon(target);
}

function fireWeapon(target) {
  const p = G.player;
  const def = WEAPONS[p.weapon];
  const ws = p.weapons[p.weapon];

  ws.ammo--;
  ws.fireT = def.rate * p.fireRateMult;
  p.muzzle = 0.07;
  G.shake = Math.max(G.shake, def.shake);

  const superOn = p.superTimer > 0;
  const baseDmg = def.damage * p.damageMult * (superOn ? 10 : 1);
  const shots = 1 + (p.doubleShot || p.fusion ? 1 : 0);
  const n = def.pellets;
  const muzzleDist = 27;

  for (let s = 0; s < shots; s++) {
    for (let i = 0; i < n; i++) {
      let a = p.aim;
      if (n > 1) a += (i - (n - 1) / 2) * (def.spread / (n - 1));
      else a += rand(-def.spread, def.spread);
      if (shots > 1) a += (s === 0 ? -1 : 1) * 0.045;
      const mx = p.x + Math.cos(a) * muzzleDist;
      const my = p.y + Math.sin(a) * muzzleDist;
      G.bullets.push({
        x: mx, y: my, px: mx, py: my,
        vx: Math.cos(a) * def.speed,
        vy: Math.sin(a) * def.speed,
        dmg: baseDmg,
        r: def.bulletR,
        life: (def.range * p.rangeMult) / def.speed + 0.04,
        color: superOn ? '#ffe27a' : def.color,
        burn: p.cigar || p.fusion,
        burnPower: p.fusion ? 2.1 : 1,
        heavy: def.id === 'eagle'
      });
    }
  }

  // muzzle sparks
  const mx = p.x + Math.cos(p.aim) * 30;
  const my = p.y + Math.sin(p.aim) * 30;
  spawnParticles(mx, my, superOn ? '#ffd34d' : def.color, def.id === 'shotgun' ? 9 : 4, 190, 0.18, 2.4);
  spawnParticles(mx, my, 'rgba(255,255,255,0.8)', 2, 90, 0.1, 1.6);
  addFloat(mx + rand(-6, 6), my - 8, 'BANG', superOn ? '#ffe27a' : 'rgba(255,220,160,0.55)', def.id === 'shotgun' ? 13 : 11, 0.35);
  audio.sfx(def.sfx);

  if (ws.ammo <= 0) startReload();
}

/* --------------------------------------------------------------- enemies */
function hpScale() {
  return (1 + G.time * 0.011) * Math.pow(2, G.loop);
}
function speedScale() {
  return (1 + Math.min(0.4, G.time / 420)) * Math.pow(1.1, G.loop);
}

const ENEMY_TYPES = {
  trap: { r: 16, hp: 28, speed: 158, damage: 1, xp: 14, cd: 0.72 },
  cat:  { r: 24, hp: 112, speed: 97, damage: 2, xp: 42, cd: 1.0 },
  boss: { r: 52, hp: 1500, speed: 63, damage: 2, xp: 420, cd: 1.0 }
};

function makeEnemy(type, x, y) {
  const t = ENEMY_TYPES[type];
  const scale = hpScale();
  let hp = t.hp * scale;
  if (type === 'boss') hp = (1000 + G.level * 130) * Math.pow(2, G.loop) * (1 + G.time * 0.002);
  return {
    type, x, y, r: t.r, hp, maxHp: hp,
    speed: t.speed * speedScale(),
    damage: t.damage, xp: t.xp,
    attackT: rand(0.2, 0.9), attackCd: t.cd,
    flash: 0, dead: false, burn: 0, burnTick: 0, burnDps: 0,
    isBoss: type === 'boss', phase: 0, summon1: false, summon2: false,
    wobble: rand(0, TAU), bob: rand(0, TAU), enraged: false
  };
}

function spawnEnemy(type) {
  if (G.enemies.length >= 110) return;
  const p = G.player;
  const preferred = type || (Math.random() < catChance() ? 'cat' : 'trap');
  const viewW = W / G.camera.zoom, viewH = H / G.camera.zoom;
  const minR = Math.max(viewW, viewH) * 0.54 + 90;
  let x = 0, y = 0, ok = false;
  for (let i = 0; i < 18; i++) {
    const a = rand(0, TAU);
    const r = minR + rand(0, 220);
    x = clamp(p.x + Math.cos(a) * r, ARENA.pad + 24, ARENA.w - ARENA.pad - 24);
    y = clamp(p.y + Math.sin(a) * r, ARENA.pad + 24, ARENA.h - ARENA.pad - 24);
    if (dist(x, y, p.x, p.y) > minR * 0.72) { ok = true; break; }
  }
  if (!ok) {
    for (let i = 0; i < 20; i++) {
      x = rand(ARENA.pad + 40, ARENA.w - ARENA.pad - 40);
      y = rand(ARENA.pad + 40, ARENA.h - ARENA.pad - 40);
      if (dist(x, y, p.x, p.y) > 420) break;
    }
  }
  G.enemies.push(makeEnemy(preferred, x, y));
}

function catChance() {
  return clamp(0.16 + G.time * 0.0009 + G.loop * 0.08, 0.16, 0.58);
}

function spawnBoss(level) {
  if (G.boss) return;
  const p = G.player;
  const angle = rand(0, TAU);
  const e = makeEnemy('boss', clamp(p.x + Math.cos(angle) * 420, 300, ARENA.w - 300), clamp(p.y + Math.sin(angle) * 420, 300, ARENA.h - 300));
  e.hp = e.maxHp;
  G.enemies.push(e);
  G.boss = e;
  G.shake = 18;
  audio.sfx('boss');
  toast('CHEFÃO: DON GATTO', 'red');
  addFloat(e.x, e.y - 90, 'DON GATTO', '#ff8a7f', 28, 2.2);
}

function summonCats(boss, count) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const e = makeEnemy('cat', clamp(boss.x + Math.cos(a) * 110, 160, ARENA.w - 160), clamp(boss.y + Math.sin(a) * 110, 160, ARENA.h - 160));
    e.speed *= 1.1;
    G.enemies.push(e);
  }
  spawnParticles(boss.x, boss.y, '#b07cff', 22, 220, 0.7, 4);
  toast('A MÁFIA CHAMOU REFORÇOS', 'red');
}

function updateEnemies(dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.flash > 0) e.flash -= dt;

    if (e.burn > 0) {
      e.burn -= dt;
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.34;
        e.hp -= e.burnDps * 0.34;
        addFloat(e.x + rand(-10, 10), e.y - e.r - 10, Math.round(e.burnDps * 0.34), '#ff9a4d', 10, 0.5);
        spawnParticles(e.x + rand(-8, 8), e.y + rand(-8, 8), '#ff8a3c', 1, 45, 0.3, 2.5);
        if (e.hp <= 0) { killEnemy(e); continue; }
      }
      if (Math.random() < dt * 12) spawnParticles(e.x + rand(-10, 10), e.y + rand(-10, 10), 'rgba(255,120,40,0.8)', 1, 28, 0.45, 2.2);
    }

    if (e.isBoss) {
      updateBoss(e, dt);
      continue;
    }

    const d = dist(e.x, e.y, p.x, p.y);
    const a = angleTo(e.x, e.y, p.x, p.y);
    const wob = Math.sin(G.time * 7 + e.wobble) * (e.type === 'trap' ? 0.32 : 0.11);
    if (d > e.r + p.r - 2) {
      const sp = e.speed * (e.type === 'trap' ? 1.06 : 1);
      e.x += Math.cos(a + wob) * sp * dt;
      e.y += Math.sin(a + wob) * sp * dt;
    }
    e.bob += dt * (e.type === 'trap' ? 12 : 5);

    if (e.attackT > 0) e.attackT -= dt;
    if (d < e.r + p.r + 5 && e.attackT <= 0) {
      e.attackT = e.attackCd;
      hurtPlayer(e.damage);
      e.x -= Math.cos(a) * 14;
      e.y -= Math.sin(a) * 14;
    }
  }

  // separation
  const list = G.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead) continue;
      const min = (a.r + b.r) * 0.9;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.5;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
    a.x = clamp(a.x, ARENA.pad + 12, ARENA.w - ARENA.pad - 12);
    a.y = clamp(a.y, ARENA.pad + 12, ARENA.h - ARENA.pad - 12);
  }
}

function updateBoss(e, dt) {
  const p = G.player;
  const d = dist(e.x, e.y, p.x, p.y);
  const a = angleTo(e.x, e.y, p.x, p.y);
  if (e.hp < e.maxHp * 0.66 && !e.summon1) { e.summon1 = true; summonCats(e, 3); }
  if (e.hp < e.maxHp * 0.33 && !e.summon2) { e.summon2 = true; e.enraged = true; summonCats(e, 4); }
  const sp = e.speed * (e.enraged ? 1.35 : 1);
  if (d > 260) {
    e.x += Math.cos(a) * sp * dt;
    e.y += Math.sin(a) * sp * dt;
  } else if (d < 165) {
    e.x -= Math.cos(a) * sp * dt;
    e.y -= Math.sin(a) * sp * dt;
  } else {
    e.x += Math.cos(a + Math.PI / 2) * sp * 0.55 * dt;
    e.y += Math.sin(a + Math.PI / 2) * sp * 0.55 * dt;
  }
  e.bob += dt * 3;

  e.attackT -= dt;
  if (e.attackT <= 0 && d < 900) {
    e.attackT = e.enraged ? 1.25 : 1.8;
    const count = e.enraged ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const ang = a + (i - (count - 1) / 2) * 0.17;
      G.ebullets.push({
        x: e.x + Math.cos(ang) * 42, y: e.y + Math.sin(ang) * 42,
        vx: Math.cos(ang) * 315, vy: Math.sin(ang) * 315,
        r: 7, dmg: 1, life: 3.6, rot: ang
      });
    }
    spawnParticles(e.x + Math.cos(a) * 48, e.y + Math.sin(a) * 48, '#ff6b3d', 8, 120, 0.3, 3);
    audio.sfx('shotgun');
  }

  if (d < e.r + p.r + 6 && e.attackT < e.attackCd - 0.12) {
    // contact is handled by the generic attack clock: give it a dedicated nudge
    if (!e._touchT || G.time - e._touchT > 1.1) {
      e._touchT = G.time;
      hurtPlayer(2);
    }
  }
}

/* ---------------------------------------------------------------- bullets */
function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0.0001) t = clamp(((cx - x1) * dx + (cy - y1) * dy) / len2, 0, 1);
  const px = x1 + dx * t, py = y1 + dy * t;
  const ddx = px - cx, ddy = py - cy;
  return ddx * ddx + ddy * ddy <= r * r;
}

function updateBullets(dt) {
  const p = G.player;
  for (const b of G.bullets) {
    b.px = b.x; b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (Math.random() < 0.55) {
      spawnParticles(b.x, b.y, hexA(b.color, 0.5), 1, 18, 0.16, b.heavy ? 2.4 : 1.7);
    }
    if (b.life <= 0 || b.x < 40 || b.x > ARENA.w - 40 || b.y < 40 || b.y > ARENA.h - 40) {
      b.dead = true;
      continue;
    }
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (segmentHitsCircle(b.px, b.py, b.x, b.y, e.x, e.y, e.r + b.r)) {
        hitEnemy(e, b);
        b.dead = true;
        break;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);

  for (const b of G.ebullets) {
    const px = b.x, py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    b.rot = Math.atan2(b.vy, b.vx);
    if (b.life <= 0) { b.dead = true; continue; }
    if (segmentHitsCircle(px, py, b.x, b.y, p.x, p.y, p.r + b.r)) {
      b.dead = true;
      hurtPlayer(b.dmg);
      spawnParticles(b.x, b.y, '#ff6b3d', 8, 130, 0.35, 2.5);
    }
  }
  G.ebullets = G.ebullets.filter((b) => !b.dead);
}

function hitEnemy(e, b) {
  if (e.dead) return;
  const crit = Math.random() < 0.08;
  const dmg = b.dmg * (crit ? 2 : 1);
  e.hp -= dmg;
  e.flash = 0.1;
  addFloat(e.x + rand(-9, 9), e.y - e.r - 8, Math.round(dmg), crit ? '#ffe27a' : '#fff3d4', crit ? 17 : 12, 0.55);
  spawnParticles(b.x, b.y, crit ? '#ffe27a' : '#ffcf92', crit ? 7 : 3, 155, 0.3, 2.2);
  spawnParticles(b.x, b.y, 'rgba(255,255,255,0.9)', 1, 80, 0.15, 1.4);
  if (b.burn) {
    e.burn = Math.max(e.burn, 3);
    e.burnTick = Math.min(e.burnTick || 0.34, 0.2);
    e.burnDps = Math.max(e.burnDps, b.dmg * (b.burnPower || 1) * 0.42);
  }
  if (G.time - lastHitSfx > 0.045) {
    lastHitSfx = G.time;
    audio.sfx(crit ? 'crit' : 'hit');
  }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  G.kills++;
  G.score += e.isBoss ? 2500 : Math.round(10 * (1 + G.loop * 0.5));
  audio.sfx(e.isBoss ? 'boss' : 'kill');
  G.shake = Math.max(G.shake, e.isBoss ? 24 : 3);
  spawnParticles(e.x, e.y, '#b33a34', e.isBoss ? 38 : 8, e.isBoss ? 330 : 150, 0.6, 3.4);
  spawnParticles(e.x, e.y, '#3a3038', e.isBoss ? 26 : 5, 200, 0.8, 4);
  G.splats.push(makeSplat(e.x, e.y, e.isBoss ? 2.2 : 1));
  if (G.splats.length > 55) G.splats.shift();

  if (e.isBoss) {
    rewardBoss(e);
  } else {
    const count = e.type === 'cat' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      G.pickups.push({
        kind: 'xp', x: e.x + rand(-18, 18), y: e.y + rand(-16, 16),
        value: e.xp / count, age: 0, bob: rand(0, TAU),
        vx: rand(-40, 40), vy: rand(-40, 40)
      });
    }
    const chanceSuper = e.type === 'trap' ? 0.016 : 0.028;
    if (Math.random() < chanceSuper) {
      G.pickups.push({ kind: 'super', x: e.x + 6, y: e.y - 6, value: 0, age: 0, bob: rand(0, TAU), vx: 0, vy: -30 });
      toast('QUEIJO DOURADO CAIU!', 'gold');
    }
    if (Math.random() < 0.022) {
      G.pickups.push({ kind: 'heart', x: e.x - 10, y: e.y + 8, value: 1, age: 0, bob: rand(0, TAU), vx: 0, vy: 0 });
    }
    if (e.type === 'cat' && Math.random() < 0.09) {
      G.pickups.push({ kind: 'weapon', x: e.x + 10, y: e.y, value: 0, age: 0, bob: rand(0, TAU), vx: 0, vy: 0 });
    }
  }
  G.enemies = G.enemies.filter((en) => !en.dead);
}

function rewardBoss(e) {
  G.boss = null;
  G.score += 1500;
  G.money += 150;
  healPlayer(1);
  // legendary reward
  const available = ['eye'].filter((id) => !G.player.skills[id])
    .concat(Object.keys(SKILLS).filter((id) => SKILLS[id].rarity === 'legendary' && id !== 'eye' && !G.player.skills[id]));
  if (available.length) {
    const id = available[Math.floor(Math.random() * available.length)];
    unlockSkill(id);
    toast('LENDÁRIO: ' + SKILLS[id].name.toUpperCase(), 'gold');
  } else {
    G.player.maxHearts++;
    healPlayer(2);
    toast('BÔNUS: +1 CORAÇÃO MÁXIMO', 'gold');
  }
  // rewards scatter
  for (let i = 0; i < 10; i++) {
    G.pickups.push({
      kind: 'xp', x: e.x + rand(-60, 60), y: e.y + rand(-50, 50),
      value: 45, age: 0, bob: rand(0, TAU), vx: rand(-70, 70), vy: rand(-70, 70)
    });
  }
  G.pickups.push({ kind: 'super', x: e.x, y: e.y + 20, value: 0, age: 0, bob: 0, vx: 0, vy: 0 });
  G.pickups.push({ kind: 'weapon', x: e.x + 34, y: e.y, value: 0, age: 0, bob: 0, vx: 0, vy: 0 });
  toast('DON GATTO CAIU. A CIDADE RESPIRA.', 'gold');
  addFloat(e.x, e.y - 80, 'RECOMPENSA LENDÁRIA', '#e9b949', 24, 2.2);
  spawnParticles(e.x, e.y, '#e9b949', 40, 300, 1.1, 4);
}

/* ---------------------------------------------------------------- pickups */
function updatePickups(dt) {
  const p = G.player;
  for (const u of G.pickups) {
    u.age += dt;
    u.bob += dt * 3;
    const d = dist(u.x, u.y, p.x, p.y);
    const pull = u.kind === 'super' ? 1.3 : 1;
    if (d < p.magnet * pull) {
      const a = angleTo(u.x, u.y, p.x, p.y);
      const sp = 260 + (p.magnet - d) * 4.2;
      u.x += Math.cos(a) * sp * dt;
      u.y += Math.sin(a) * sp * dt;
    } else {
      u.x += (u.vx || 0) * dt;
      u.y += (u.vy || 0) * dt;
      u.vx *= 0.92; u.vy *= 0.92;
      // cheese eventually rolls toward the detective so far kills still count
      if (u.kind === 'xp' && u.age > 1.2 && d > 40) {
        const a = angleTo(u.x, u.y, p.x, p.y);
        const sp = Math.min(190, 55 + (u.age - 1.2) * 22);
        u.x += Math.cos(a) * sp * dt;
        u.y += Math.sin(a) * sp * dt;
      }
    }
    if (d < 27) collectPickup(u);
  }
  G.pickups = G.pickups.filter((u) => !u.dead);
}

function collectPickup(u) {
  u.dead = true;
  const p = G.player;
  if (u.kind === 'xp') {
    G.cheese++;
    gainXP(u.value);
    audio.sfx('cheese');
    spawnParticles(u.x, u.y, '#ffe08a', 3, 90, 0.3, 2);
  } else if (u.kind === 'super') {
    activateSuper();
  } else if (u.kind === 'weapon') {
    const next = p.weapons.findIndex((w) => !w.unlocked);
    if (next >= 0) {
      p.weapons[next].unlocked = true;
      p.weapons[next].ammo = WEAPONS[next].ammo;
      p.weapon = next;
      buildWeaponBar();
      updateWeaponBar();
      audio.sfx('unlock');
      toast(WEAPONS[next].name + ' DESBLOQUEADA', 'blue');
      addFloat(u.x, u.y - 26, 'NOVA ARMA', '#9fe8ff', 18, 1.4);
    } else {
      healPlayer(1);
      G.score += 250;
      toast('MALETA DE MUNIÇÃO: +1 VIDA', 'blue');
    }
    spawnParticles(u.x, u.y, '#9fe8ff', 16, 180, 0.6, 3);
  } else if (u.kind === 'heart') {
    healPlayer(1);
    audio.sfx('pickup');
    toast('+1 VIDA', 'red');
  }
}

function activateSuper() {
  const p = G.player;
  p.superTimer = 15;
  p.invuln = Math.max(p.invuln, 15);
  audio.sfx('super');
  G.shake = 14;
  flashScreen('super');
  toast('SUPERQUEIJO! DANO ×10 POR 15s', 'gold');
  addFloat(p.x, p.y - 46, 'SUPERQUEIJO!', '#ffe27a', 24, 1.6);
  spawnParticles(p.x, p.y, '#ffd34d', 34, 260, 1.0, 4);
  updateBuffBar();
}

/* --------------------------------------------------------------- damage fx */
function hurtPlayer(amount) {
  const p = G.player;
  if (!p || G.state !== 'playing' || p.dead || G.god) return;
  if (p.invuln > 0 || p.superTimer > 0) return;
  const dmg = Math.max(1, amount - (p.skills.vest || 0));
  p.hits -= dmg;
  p.hurtFlash = 0.3;
  p.invuln = 1.1;
  G.shake = 13;
  audio.sfx('hurt');
  flashScreen('hurt');
  addFloat(p.x, p.y - 30, '-' + dmg, '#ff5a4e', 18, 0.9);
  spawnParticles(p.x, p.y, '#b33a34', 12, 160, 0.5, 3);
  if (p.hits <= 0) {
    p.hearts--;
    if (p.hearts <= 0) {
      p.hearts = 0;
      die();
      return;
    }
    p.hits = p.hitsPerHeart;
  }
  updateHearts();
}

function healPlayer(n) {
  const p = G.player;
  if (!p) return;
  if (p.hearts < p.maxHearts) {
    p.hearts = Math.min(p.maxHearts, p.hearts + n);
    p.hits = p.hitsPerHeart;
    spawnParticles(p.x, p.y, '#ff7a7a', 12, 130, 0.6, 3);
  } else {
    G.score += 100 * n;
  }
  updateHearts();
}

function die() {
  const p = G.player;
  p.dead = true;
  G.state = 'dying';
  G.deathT = 1.25;
  G.shake = 30;
  audio.sfx('death');
  spawnParticles(p.x, p.y, '#b33a34', 38, 280, 1.2, 4);
  spawnParticles(p.x, p.y, '#6b5f4c', 24, 180, 1.0, 3);
  G.splats.push(makeSplat(p.x, p.y, 2.4));
  hideJoystick();
  updateHearts();
}

/* --------------------------------------------------------------- fx utils */
function spawnParticles(x, y, color, count, speed, life, size, opts = {}) {
  if (G.particles.length > 520) return;
  for (let i = 0; i < count; i++) {
    const a = opts.angle !== undefined ? opts.angle + rand(-0.5, 0.5) : rand(0, TAU);
    const sp = rand(speed * 0.25, speed);
    G.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rand(life * 0.5, life),
      max: life,
      size: rand(size * 0.5, size),
      color,
      drag: opts.drag !== undefined ? opts.drag : 0.9,
      grav: opts.grav || 0,
      shape: opts.shape || 'circle',
      rot: rand(0, TAU),
      vr: rand(-8, 8)
    });
  }
}

function updateParticles(dt) {
  for (const q of G.particles) {
    q.life -= dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += q.grav * dt;
    const dr = Math.pow(q.drag, dt * 60);
    q.vx *= dr; q.vy *= dr;
    q.rot += q.vr * dt;
  }
  G.particles = G.particles.filter((q) => q.life > 0);
}

function addFloat(x, y, text, color = '#fff3d4', size = 12, life = 0.7) {
  if (G.texts.length > 46) G.texts.shift();
  G.texts.push({ x, y, vy: -45, text: String(text), color, size, life, max: life });
  G.texts[G.texts.length - 1].x = clamp(x, 20, ARENA.w - 20);
}

function updateTexts(dt) {
  for (const t of G.texts) {
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= 0.94;
  }
  G.texts = G.texts.filter((t) => t.life > 0);
}

function makeSplat(x, y, scale) {
  const blobs = [];
  const n = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    blobs.push({
      dx: rand(-22, 22) * scale, dy: rand(-15, 15) * scale,
      rx: rand(3, 10) * scale, ry: rand(2, 7) * scale, a: rand(0, TAU)
    });
  }
  return { x, y, scale, life: 16, max: 16, blobs };
}

function updateSplats(dt) {
  for (const s of G.splats) s.life -= dt;
  G.splats = G.splats.filter((s) => s.life > 0);
}

/* -------------------------------------------------------------- camera/fx */
function updateCamera(dt) {
  const p = G.player;
  if (!p) return;
  const cam = G.camera;
  const targetZoom = zoomBase * (G.boss ? 0.95 : 1);
  cam.zoom = lerp(cam.zoom, targetZoom, 1 - Math.pow(0.001, dt));
  const look = 34;
  cam.x = lerp(cam.x, p.x + Math.cos(p.aim) * look, 1 - Math.pow(0.0005, dt));
  cam.y = lerp(cam.y, p.y + Math.sin(p.aim) * look - 10, 1 - Math.pow(0.0005, dt));
  const vw = W / cam.zoom, vh = H / cam.zoom;
  cam.x = vw >= ARENA.w ? ARENA.w / 2 : clamp(cam.x, vw / 2 + 20, ARENA.w - vw / 2 - 20);
  cam.y = vh >= ARENA.h ? ARENA.h / 2 : clamp(cam.y, vh / 2 + 20, ARENA.h - vh / 2 - 20);
  G.shake = Math.max(0, G.shake - dt * 38);
  G.flashSky = Math.max(0, G.flashSky - dt);
  if (Math.random() < dt * 0.035) G.flashSky = 0.14;
}

/* ---------------------------------------------------------------- spawning */
function updateSpawner(dt) {
  if (G.enemies.length >= 110) return;
  G.spawnTimer -= dt;
  if (G.spawnTimer > 0) return;
  const interval = Math.max(0.34, 1.3 - G.time * 0.0032 - G.level * 0.008);
  G.spawnTimer = interval;
  let count = 1;
  if (G.time > 80) count++;
  if (G.time > 210) count++;
  if (G.boss) count = Math.max(1, count - 1);
  for (let i = 0; i < count; i++) spawnEnemy();
}

/* ------------------------------------------------------------- main update */
function updateGame(dt) {
  const p = G.player;
  G.time += dt;
  p.invuln = Math.max(0, p.invuln - dt);
  p.superTimer = Math.max(0, p.superTimer - dt);
  p.muzzle = Math.max(0, p.muzzle - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);

  updateMovement(dt);
  updateWeapons(dt);
  autoAimAndFire(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateTexts(dt);
  updateSplats(dt);
  updateSpawner(dt);
  updateCamera(dt);
  updateBuffBar();
  updateHUD();
}

function updateDying(dt) {
  G.deathT -= dt;
  updateParticles(dt);
  updateTexts(dt);
  updateSplats(dt);
  updateBullets(dt);
  updateCamera(dt);
  if (G.deathT <= 0) showGameOver();
}
