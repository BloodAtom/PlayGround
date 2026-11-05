/* ============================================================================
   main: boot, input, UI wiring, animation loop
   ============================================================================ */

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

let joyPointer = null;
const joyCenter = { x: 0, y: 0 };

function updateMenu(dt) {
  // ambient menu drift; particles from the attract scene can settle
  if (G.particles.length) updateParticles(dt);
  if (G.texts.length) updateTexts(dt);
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - frame.last) / 1000 || 0.016));
  frame.last = now;
  G.menuT += dt;

  if (G.state === 'playing') updateGame(dt);
  else if (G.state === 'dying') updateDying(dt);
  else if (G.state === 'loop') updateLoopState(dt);
  else if (G.state === 'menu') updateMenu(dt);

  render(dt);
  requestAnimationFrame(frame);
}
frame.last = performance.now();

/* ------------------------------------------------------------------ input */
function onKeyDown(e) {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.repeat && !['1', '2', '3', 'r', 'p'].includes(k)) return;
  input.keys.add(k);

  if (G.state === 'menu') {
    if (k === 'enter' || k === ' ') startGame(G.chosenWeapon);
    return;
  }
  if (G.state === 'gameover') {
    if (k === 'enter' || k === ' ') startGame(G.chosenWeapon);
    else if (k === 'escape') returnToMenu();
    return;
  }
  if (G.state === 'levelup') {
    if (k === '1' || k === '2' || k === '3') selectSkill(parseInt(k, 10) - 1);
    return;
  }
  if (G.state === 'paused') {
    if (k === 'escape' || k === 'p') resumeGame();
    return;
  }
  if (G.state === 'playing') {
    if (k === '1' || k === '2' || k === '3') switchWeapon(parseInt(k, 10) - 1);
    else if (k === 'r') startReload();
    else if (k === 'escape' || k === 'p') pauseGame();
  }
}

function onKeyUp(e) {
  input.keys.delete(e.key.toLowerCase());
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('blur', () => {
  input.keys.clear();
  hideJoystick();
  if (G.state === 'playing') pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === 'playing') pauseGame();
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

/* --------------------------------------------------------------- joystick */
function setupTouchControls() {
  const zone = E.touchZone;

  const start = (e) => {
    if (G.state !== 'playing') return;
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    joyPointer = e.pointerId;
    joyCenter.x = e.clientX;
    joyCenter.y = e.clientY;
    input.joy.active = true;
    E.joystick.style.left = e.clientX + 'px';
    E.joystick.style.top = e.clientY + 'px';
    E.joystick.classList.add('active');
    move(e);
    try { zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const move = (e) => {
    if (e.pointerId !== joyPointer) return;
    e.preventDefault();
    let dx = e.clientX - joyCenter.x;
    let dy = e.clientY - joyCenter.y;
    const d = Math.hypot(dx, dy);
    const max = 46;
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    const nx = dx / max, ny = dy / max;
    input.joy.x = nx;
    input.joy.y = ny;
    const knob = E.joystick.querySelector('.joy-knob');
    if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const end = (e) => {
    if (e.pointerId !== joyPointer) return;
    joyPointer = null;
    input.joy.x = 0;
    input.joy.y = 0;
    input.joy.active = false;
    E.joystick.classList.remove('active');
    const knob = E.joystick.querySelector('.joy-knob');
    if (knob) knob.style.transform = 'translate(0, 0)';
  };

  zone.addEventListener('pointerdown', start, { passive: false });
  zone.addEventListener('pointermove', move, { passive: false });
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);
}

/* ------------------------------------------------------------------- boot */
function initUI() {
  buildStartChoices();
  E.menuBest.textContent = fmtNum(G.best);
  E.btnSound.classList.toggle('muted', G.muted);
  E.btnSound.textContent = '♪';
  E.btnSound.setAttribute('aria-label', G.muted ? 'Ativar som' : 'Silenciar');

  $('btn-start').addEventListener('click', () => {
    audio.init();
    audio.resume();
    startGame(G.chosenWeapon);
  });
  $('btn-retry').addEventListener('click', () => {
    audio.resume();
    startGame(G.chosenWeapon);
  });
  $('btn-menu').addEventListener('click', returnToMenu);
  $('btn-resume').addEventListener('click', resumeGame);
  $('btn-restart').addEventListener('click', () => {
    audio.resume();
    startGame(G.chosenWeapon);
  });
  $('btn-quit').addEventListener('click', returnToMenu);
  $('btn-pause').addEventListener('click', () => {
    if (G.state === 'playing') pauseGame();
    else if (G.state === 'paused') resumeGame();
  });
  E.btnSound.addEventListener('click', () => {
    audio.init();
    audio.setMuted(!G.muted);
    E.btnSound.classList.toggle('muted', G.muted);
    E.btnSound.setAttribute('aria-label', G.muted ? 'Ativar som' : 'Silenciar');
  });

  setupTouchControls();
  document.addEventListener('pointerdown', () => { audio.init(); audio.resume(); }, { once: true });
}

/* --------------------------------------------------------------- debug API */
window.__RATO = {
  start: (weapon = 0) => { G.chosenWeapon = weapon; startGame(weapon); },
  menu: returnToMenu,
  state: () => G.state,
  player: () => G.player,
  addXP: (n) => gainXP(n),
  levelUp: () => { if (G.player) { G.pendingLevels++; openLevelUp(); } },
  boss: () => { if (G.player) { G.bossNext = 10; spawnBoss(G.level); } },
  superCheese: () => { if (G.player) activateSuper(); },
  god: (v = true) => { G.god = v; },
  die: () => { if (G.player) die(); },
  spawn: (type) => spawnEnemy(type),
  clear: () => { G.enemies.forEach((e) => { e.hp = 0; killEnemy(e); }); },
  weapon: (i) => switchWeapon(i),
  setTime: (t) => { G.time = t; },
  info: () => ({
    state: G.state, level: G.level, xp: G.xp, xpNext: G.xpNext,
    kills: G.kills, loop: G.loop, enemies: G.enemies.length,
    boss: !!G.boss, score: G.score, time: G.time,
    hearts: G.player ? G.player.hearts : 0,
    weapon: G.player ? G.player.weapon : -1,
    unlocked: G.player ? G.player.weapons.map((w) => w.unlocked) : []
  }),
  fps: () => G.menuT
};

/* -------------------------------------------------------------------- go */
resize();
buildWorld();
initUI();
requestAnimationFrame(frame);
