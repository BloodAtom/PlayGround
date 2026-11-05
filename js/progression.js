/* ============================================================================
   progression: XP, skills, loop, flow, HUD
   ============================================================================ */

const E = {
  hud: $('hud'), hearts: $('hearts'),
  xpFill: $('xp-fill'), levelLabel: $('level-label'), cheeseLabel: $('cheese-label'),
  scoreLabel: $('score-label'), bossWrap: $('boss-wrap'), bossFill: $('boss-fill'),
  bossTitle: $('boss-title'), bossPct: $('boss-pct'), buffs: $('buffs'),
  weapons: $('weapons'), hint: $('hint'), touchZone: $('touch-zone'), joystick: $('joystick'),
  menu: $('screen-menu'), levelup: $('screen-levelup'), pause: $('screen-pause'),
  gameover: $('screen-gameover'), luLevel: $('lu-level'), luCards: $('lu-cards'),
  toasts: $('toasts'), flash: $('flash'), loopBanner: $('loop-banner'), loopNum: $('loop-num'),
  startWeapons: $('start-weapons'), menuBest: $('menu-best'),
  pauseStats: $('pause-stats'), goScore: $('go-score'), goLevel: $('go-level'),
  goLoops: $('go-loops'), goKills: $('go-kills'), goCheese: $('go-cheese'),
  goTime: $('go-time'), goRecord: $('go-record'), goTitle: $('go-title'),
  goSub: $('go-sub'), goEyebrow: $('go-eyebrow'), btnSound: $('btn-sound')
};

let heartEls = [];
let weaponEls = [];
let hudCache = { level: '', cheese: '', score: '', boss: '', buff: '', hearts: '' };
let toastSeq = 0;

function xpForLevel(level) {
  return Math.round(85 + (level - 1) * 72 + Math.pow(level, 1.35) * 2);
}

/* ------------------------------------------------------------------ flow */
function startGame(weaponIndex) {
  G.runId++;
  const runId = G.runId;
  audio.resume();
  G.state = 'playing';
  G.time = 0;
  G.score = 0;
  G.money = 0;
  G.kills = 0;
  G.cheese = 0;
  G.level = 1;
  G.xp = 0;
  G.xpNext = xpForLevel(1);
  G.loop = 0;
  G.enemies = [];
  G.bullets = [];
  G.ebullets = [];
  G.pickups = [];
  G.particles = [];
  G.texts = [];
  G.splats = [];
  G.boss = null;
  G.bossNext = 10;
  G.pendingLevels = 0;
  G.levelChoices = [];
  G.spawnTimer = 0.9;
  G.shake = 0;
  G.flashSky = 0;
  G.deathT = 0;
  G.newRecord = false;
  G.god = false;
  G.player = createPlayer(weaponIndex);
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.camera.zoom = zoomBase;

  for (let i = 0; i < 2; i++) {
    const a = rand(0, TAU);
    const e = makeEnemy('trap',
      clamp(G.player.x + Math.cos(a) * 350, ARENA.pad + 30, ARENA.w - ARENA.pad - 30),
      clamp(G.player.y + Math.sin(a) * 350, ARENA.pad + 30, ARENA.h - ARENA.pad - 30));
    G.enemies.push(e);
  }

  E.menu.classList.add('hidden');
  E.levelup.classList.add('hidden');
  E.pause.classList.add('hidden');
  E.gameover.classList.add('hidden');
  E.loopBanner.classList.add('hidden');
  E.hud.classList.remove('hidden');
  E.toasts.innerHTML = '';
  E.hint.classList.remove('fade');
  E.flash.style.opacity = '0';
  hideJoystick();

  buildHearts();
  buildWeaponBar();
  updateHUD(true);
  updateBuffBar(true);

  toast('A CIDADE ESTÁ PODRE, DETETIVE.', 'gold');

  setTimeout(() => {
    if (G.runId === runId && G.state === 'playing') E.hint.classList.add('fade');
  }, 10000);
}

function returnToMenu() {
  G.state = 'menu';
  G.player = null;
  G.enemies = [];
  G.bullets = [];
  G.ebullets = [];
  G.pickups = [];
  G.particles = [];
  G.texts = [];
  G.splats = [];
  G.boss = null;
  G.pendingLevels = 0;
  G.camera.x = ARENA.w / 2;
  G.camera.y = ARENA.h / 2;
  G.camera.zoom = zoomBase;
  G.menuT = 0;
  E.hud.classList.add('hidden');
  E.levelup.classList.add('hidden');
  E.pause.classList.add('hidden');
  E.gameover.classList.add('hidden');
  E.menu.classList.remove('hidden');
  E.loopBanner.classList.add('hidden');
  E.toasts.innerHTML = '';
  hideJoystick();
  E.buffs.innerHTML = '';
  hudCache.buff = '';
  E.menuBest.textContent = fmtNum(G.best);
}

function pauseGame() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  hideJoystick();
  const p = G.player;
  E.pauseStats.innerHTML = `
    <div>NÍVEL<b>${G.level}</b></div>
    <div>ABATES<b>${G.kills}</b></div>
    <div>LOOP<b>${G.loop}</b></div>
    <div>TEMPO<b>${formatTime(G.time)}</b></div>
    <div>QUEIJO<b>${G.cheese}</b></div>
    <div>PONTOS<b>${fmtNum(G.score)}</b></div>`;
  E.pause.classList.remove('hidden');
  audio.sfx('reload');
}

function resumeGame() {
  if (G.state !== 'paused') return;
  G.state = 'playing';
  E.pause.classList.add('hidden');
}

function showGameOver() {
  if (G.state === 'gameover') return;
  G.state = 'gameover';
  hideJoystick();
  E.bossWrap.classList.add('hidden');
  E.goScore.textContent = fmtNum(G.score);
  E.goLevel.textContent = G.level;
  E.goLoops.textContent = G.loop;
  E.goKills.textContent = G.kills;
  E.goCheese.textContent = G.cheese;
  E.goTime.textContent = formatTime(G.time);
  G.newRecord = G.score > G.best;
  if (G.newRecord) {
    G.best = G.score;
    storeSet('rato_best', G.best);
    E.goRecord.textContent = 'NOVO RECORDE!';
    E.goRecord.classList.remove('dim');
    E.goEyebrow.textContent = 'A CIDADE LEMBRARÁ';
    E.goTitle.textContent = 'UM NOVO RECORDE';
    E.goSub.textContent = 'A máfia felina caiu. Por enquanto.';
  } else {
    E.goRecord.textContent = 'RECORDE: ' + fmtNum(G.best);
    E.goRecord.classList.add('dim');
    E.goEyebrow.textContent = 'FIM DA LINHA';
    E.goTitle.textContent = 'O DETETIVE CAIU';
    E.goSub.textContent = 'A máfia felina tomou a cidade. Por enquanto.';
  }
  E.menuBest.textContent = fmtNum(G.best);
  E.gameover.classList.remove('hidden');
  audio.sfx('death');
}

/* -------------------------------------------------------------------- XP */
function gainXP(amount) {
  if (!G.player) return;
  if (G.state !== 'playing' && G.state !== 'levelup') return;
  const gained = Math.max(1, Math.round(amount * G.player.xpMult));
  G.xp += gained;

  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.score += 100;
    G.xpNext = xpForLevel(G.level);

    if (G.level >= 50) {
      triggerLoop();
      return;
    }
    if (G.level === G.bossNext) {
      G.bossNext += 10;
      spawnBoss(G.level);
    } else {
      G.pendingLevels++;
    }
    audio.sfx('levelup');
  }

  if (G.pendingLevels > 0 && G.state === 'playing') openLevelUp();
  updateHUD(true);
}

/* ---------------------------------------------------------------- skills */
function unlockSkill(id) {
  if (!SKILLS[id]) return;
  const p = G.player;
  const current = p.skills[id] || 0;
  const max = SKILLS[id].max;
  if (current >= max) return;
  p.skills[id] = current + 1;

  switch (id) {
    case 'speed': p.speedMult *= 1.10; break;
    case 'damage': p.damageMult *= 1.15; break;
    case 'vest': break;
    case 'rapid': p.fireRateMult *= 0.82; break;
    case 'magnet': p.magnet *= 1.4; break;
    case 'flaming': p.cigar = true; break;
    case 'double': p.doubleShot = true; break;
    case 'eye': p.rangeMult *= 1.4; p.damageMult *= 1.1; break;
    case 'heart':
      p.maxHearts++;
      p.hearts = p.maxHearts;
      p.hits = p.hitsPerHeart;
      buildHearts();
      break;
    case 'fusion':
      p.fusion = true; p.cigar = true; p.doubleShot = true;
      break;
  }

  if ((p.cigar && p.doubleShot) && !p.fusion && id !== 'fusion') {
    p.skills.fusion = 1;
    p.fusion = true;
    toast('FUSÃO: CHAMA DO SUBMUNDO!', 'gold');
    addFloat(p.x, p.y - 60, 'FUSÃO!', '#ff8a4d', 26, 1.6);
    audio.sfx('super');
    G.shake = 12;
    spawnParticles(p.x, p.y, '#ff6b3d', 28, 240, 0.9, 4);
  }
}

function skillWeight(rarity) {
  return { common: 10, rare: 6, epic: 3.2, legendary: 1.2, fusion: 0 }[rarity] || 1;
}

function generateChoices() {
  const p = G.player;
  const available = Object.keys(SKILLS).filter((id) => {
    if (id === 'fusion') return false;
    return (p.skills[id] || 0) < SKILLS[id].max;
  });
  if (!available.length) return [];
  const pool = [];
  for (const id of available) {
    const w = Math.round(skillWeight(SKILLS[id].rarity) * 2);
    for (let i = 0; i < w; i++) pool.push(id);
  }
  const choices = [];
  while (choices.length < 3 && pool.length) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    if (!choices.includes(id)) choices.push(id);
    for (let i = pool.length - 1; i >= 0; i--) if (pool[i] === id) pool.splice(i, 1);
  }
  return choices;
}

function openLevelUp() {
  if (G.state !== 'playing') return;
  G.state = 'levelup';
  hideJoystick();
  G.levelChoices = generateChoices();

  if (!G.levelChoices.length) {
    G.pendingLevels--;
    healPlayer(2);
    toast('HABILIDADES NO MÁXIMO: +2 VIDA', 'gold');
    if (G.pendingLevels > 0) setTimeout(() => { if (G.state === 'levelup') openLevelUp(); }, 0);
    else G.state = 'playing';
    return;
  }

  E.luLevel.textContent = G.level;
  E.luCards.innerHTML = '';
  G.levelChoices.forEach((id, i) => {
    const s = SKILLS[id];
    const rarity = RARITY[s.rarity];
    const level = G.player.skills[id] || 0;
    const btn = document.createElement('button');
    btn.className = 'card';
    btn.style.setProperty('--rarity', rarity.color);
    let pips = '';
    for (let j = 0; j < s.max; j++) pips += `<i class="${j < level ? 'on' : ''}"></i>`;
    btn.innerHTML = `
      <div class="c-top"><span class="c-icon">${s.icon}</span><span class="c-key">${i + 1}</span></div>
      <span class="rarity">${rarity.label}</span>
      <h3>${s.name}</h3>
      <p>${s.desc}</p>
      <div class="stacks">${pips}<span>${level}/${s.max}</span></div>`;
    btn.addEventListener('click', () => selectSkill(i));
    E.luCards.appendChild(btn);
  });

  E.levelup.classList.remove('hidden');
  audio.sfx('levelup');
  G.shake = 4;
}

function selectSkill(i) {
  if (G.state !== 'levelup') return;
  const id = G.levelChoices[i];
  if (!id) return;
  unlockSkill(id);
  G.pendingLevels--;
  E.levelup.classList.add('hidden');
  if (G.pendingLevels > 0) {
    openLevelUp();
  } else {
    G.state = 'playing';
    updateHUD(true);
  }
}

/* ------------------------------------------------------------------ loop */
function triggerLoop() {
  const p = G.player;
  G.loop++;
  G.score += 5000;
  p.damageMult *= 2;
  p.xpMult *= 2;
  p.hearts = Math.min(p.maxHearts, p.hearts + 2);
  p.hits = p.hitsPerHeart;
  p.invuln = 3;
  G.level = 1;
  G.xp = 0;
  G.xpNext = xpForLevel(1);
  G.bossNext = 10;
  G.boss = null;
  G.enemies = [];
  G.bullets = [];
  G.ebullets = [];
  G.pickups = [];
  G.pendingLevels = 0;
  G.spawnTimer = 1.4;
  G.state = 'loop';
  G.loopTimer = 3.1;
  E.bossWrap.classList.add('hidden');
  E.levelup.classList.add('hidden');
  E.loopNum.textContent = G.loop;
  E.loopBanner.classList.remove('hidden');
  // restart CSS animation
  E.loopBanner.style.animation = 'none';
  void E.loopBanner.offsetWidth;
  E.loopBanner.style.animation = '';
  audio.sfx('loop');
  G.shake = 20;
  spawnParticles(p.x, p.y, '#e9b949', 40, 320, 1.2, 5);
  updateHUD(true);
}

function updateLoopState(dt) {
  G.loopTimer -= dt;
  updateParticles(dt);
  updateTexts(dt);
  updateSplats(dt);
  updateCamera(dt);
  if (G.loopTimer <= 0) {
    E.loopBanner.classList.add('hidden');
    G.state = 'playing';
    G.player.invuln = 1.5;
    for (let i = 0; i < 3; i++) spawnEnemy();
    toast('LOOP ' + G.loop + ': A CIDADE AFUNDOU MAIS', 'gold');
  }
}

/* -------------------------------------------------------------------- HUD */
function buildHearts() {
  if (!G.player) return;
  E.hearts.innerHTML = '';
  heartEls = [];
  for (let i = 0; i < G.player.maxHearts; i++) {
    const d = document.createElement('div');
    d.className = 'heart';
    d.innerHTML = '<span class="hb">♥</span><span class="hf" style="width:100%">♥</span>';
    E.hearts.appendChild(d);
    heartEls.push(d);
  }
  updateHearts();
}

function updateHearts() {
  const p = G.player;
  if (!p) return;
  if (heartEls.length !== p.maxHearts) { buildHearts(); return; }
  const key = p.hearts + ':' + p.hits + ':' + p.maxHearts;
  if (hudCache.hearts === key) return;
  hudCache.hearts = key;
  for (let i = 0; i < heartEls.length; i++) {
    const fill = i < p.hearts - 1 ? 1 : (i === p.hearts - 1 ? p.hits / p.hitsPerHeart : 0);
    const el = heartEls[i].querySelector('.hf');
    el.style.width = (fill * 100) + '%';
    heartEls[i].classList.toggle('low', p.hearts <= 2 && i < p.hearts);
  }
}

function buildWeaponBar() {
  E.weapons.innerHTML = '';
  weaponEls = [];
  WEAPONS.forEach((w, i) => {
    const btn = document.createElement('button');
    btn.className = 'wpn';
    btn.dataset.index = i;
    btn.innerHTML = `
      <span class="wpn-icon">${WEAPON_ICONS[i]}</span>
      <span class="wpn-info"><span class="wpn-name"><span class="wpn-key">${i + 1}</span>${w.name}</span></span>
      <span class="wpn-ammo"></span>
      <span class="wpn-reload"></span>`;
    btn.addEventListener('click', () => { if (G.state === 'playing') switchWeapon(i); });
    E.weapons.appendChild(btn);
    weaponEls.push(btn);
  });
  updateWeaponBar();
}

function updateWeaponBar() {
  const p = G.player;
  if (!p || !weaponEls.length) return;
  p.weapons.forEach((ws, i) => {
    const el = weaponEls[i];
    if (!el) return;
    const def = WEAPONS[i];
    el.classList.toggle('locked', !ws.unlocked);
    el.classList.toggle('selected', p.weapon === i);
    el.classList.toggle('reloading', ws.reloading);
    const ammo = el.querySelector('.wpn-ammo');
    if (!ws.unlocked) {
      ammo.innerHTML = '<span class="wpn-lock">🔒</span>';
    } else if (ws.reloading) {
      ammo.textContent = 'REC';
    } else {
      ammo.innerHTML = `${ws.ammo}<small>/${def.ammo}</small>`;
    }
    const bar = el.querySelector('.wpn-reload');
    if (ws.reloading) {
      const pct = clamp(1 - ws.reloadT / def.reload, 0, 1) * 100;
      bar.style.width = pct + '%';
    } else {
      bar.style.width = '0%';
    }
  });
}

function updateBuffBar(force) {
  const p = G.player;
  if (!p) return;
  let html = '';
  if (p.superTimer > 0) {
    html += `<div class="buff"><span class="dot"></span>SUPERQUEIJO <span class="btime">${Math.ceil(p.superTimer)}s</span></div>`;
  }
  if (p.fusion) {
    html += `<div class="buff" style="border-color:#ff6b3d;color:#ff9a6b"><span class="dot" style="background:#ff6b3d;box-shadow:0 0 8px #ff6b3d"></span>CHAMA DO SUBMUNDO</div>`;
  }
  if (force || html !== hudCache.buff) {
    hudCache.buff = html;
    E.buffs.innerHTML = html;
  }
}

function updateHUD(force) {
  const p = G.player;
  if (!p) return;
  const pct = clamp(G.xp / G.xpNext, 0, 1) * 100;
  E.xpFill.style.width = pct + '%';
  const lvl = 'NÍVEL ' + G.level + (G.loop > 0 ? '  •  LOOP ' + G.loop : '');
  if (force || hudCache.level !== lvl) { hudCache.level = lvl; E.levelLabel.textContent = lvl; }
  const cheese = G.cheese + ' QUEIJOS';
  if (force || hudCache.cheese !== cheese) { hudCache.cheese = cheese; E.cheeseLabel.textContent = cheese; }
  const score = fmtNum(G.score);
  if (force || hudCache.score !== score) { hudCache.score = score; E.scoreLabel.textContent = score; }

  if (G.boss && !G.boss.dead) {
    E.bossWrap.classList.remove('hidden');
    const bp = clamp(G.boss.hp / G.boss.maxHp, 0, 1);
    E.bossFill.style.width = (bp * 100) + '%';
    E.bossPct.textContent = Math.ceil(bp * 100) + '%';
  } else {
    E.bossWrap.classList.add('hidden');
  }

  updateHearts();
  updateWeaponBar();
  updateBuffBar(force);
}

/* ------------------------------------------------------------- UI helpers */
function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  E.toasts.appendChild(el);
  toastSeq++;
  while (E.toasts.children.length > 4) E.toasts.firstChild.remove();
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 350); }, 2300);
}

function flashScreen(kind) {
  E.flash.classList.toggle('super', kind === 'super');
  E.flash.style.transition = 'none';
  E.flash.style.opacity = kind === 'super' ? '0.75' : '0.9';
  void E.flash.offsetWidth;
  E.flash.style.transition = 'opacity .38s ease-out';
  E.flash.style.opacity = '0';
}

function buildStartChoices() {
  E.startWeapons.innerHTML = '';
  WEAPONS.forEach((w, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice' + (G.chosenWeapon === i ? ' selected' : '');
    btn.innerHTML = `
      <span class="ci">${WEAPON_ICONS[i]}</span>
      <b>${w.name}</b>
      <span>${w.tag}</span>
      <span class="tag">ESCOLHIDA</span>`;
    btn.addEventListener('click', () => {
      G.chosenWeapon = i;
      audio.init();
      audio.resume();
      audio.sfx('pickup');
      buildStartChoices();
    });
    E.startWeapons.appendChild(btn);
  });
}

function hideJoystick() {
  input.joy.active = false;
  input.joy.x = 0;
  input.joy.y = 0;
  E.joystick.classList.remove('active');
}
