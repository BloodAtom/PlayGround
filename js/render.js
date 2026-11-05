/* ============================================================================
   render: world, characters, effects, weather, menu scene
   ============================================================================ */

let rainDrops = [];
let vignetteCache = { w: 0, h: 0, grad: null };
let lastRainW = 0, lastRainH = 0;

function ensureRain() {
  if (lastRainW === W && lastRainH === H && rainDrops.length) return;
  lastRainW = W; lastRainH = H;
  const count = clamp(Math.floor((W * H) / 8500), 70, 200);
  rainDrops = [];
  for (let i = 0; i < count; i++) {
    rainDrops.push({
      x: rand(-80, W + 80), y: rand(-H, H),
      len: rand(7, 22), speed: rand(520, 980), alpha: rand(0.05, 0.2)
    });
  }
}

function drawRain(dt) {
  ensureRain();
  ctx.save();
  ctx.lineCap = 'round';
  for (const d of rainDrops) {
    d.y += d.speed * dt;
    d.x += d.speed * 0.16 * dt;
    if (d.y > H + 30 || d.x > W + 60) {
      d.y = rand(-80, -10);
      d.x = rand(-100, W);
    }
    ctx.strokeStyle = `rgba(168,196,214,${d.alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - d.len * 0.16, d.y + d.len);
    ctx.stroke();
  }
  ctx.restore();
}

function getVignette() {
  if (vignetteCache.w !== W || vignetteCache.h !== H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.76);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.72, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0.72)');
    vignetteCache = { w: W, h: H, grad: g };
  }
  return vignetteCache.grad;
}

function render(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const menu = G.state === 'menu';
  let cam;
  if (menu) {
    cam = {
      x: ARENA.w / 2 + Math.sin(G.menuT * 0.11) * 180,
      y: ARENA.h / 2 + Math.cos(G.menuT * 0.14) * 100,
      zoom: Math.max(zoomBase * 0.94, 0.72)
    };
  } else {
    cam = G.camera;
  }

  const shake = menu ? 0 : G.shake;
  const sx = rand(-1, 1) * shake * 0.7;
  const sy = rand(-1, 1) * shake * 0.7;

  // static world lives on its own composited layer; just move it with the camera
  const bg = document.getElementById('bg');
  if (bg) bg.style.transform = `translate3d(${W / 2 - cam.x * cam.zoom + sx}px, ${H / 2 - cam.y * cam.zoom + sy}px, 0) scale(${cam.zoom})`;

  ctx.save();
  ctx.translate(W / 2 + sx, H / 2 + sy);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawGroundLights();

  if (menu) {
    drawMenuScene();
  } else {
    drawSplats();
    drawPickups();
    drawEntities();
    drawBullets();
    drawParticles();
    drawTexts();
    drawBloom();
  }

  ctx.restore();

  drawRain(dt);
  drawScreenOverlay();
}

/* --------------------------------------------------------------- lighting */
function drawGroundLights() {
  if (!lightSprite) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const l of lamps) {
    if (Math.abs(l.x - G.camera.x) > 1200 || Math.abs(l.y - G.camera.y) > 1000) continue;
    const flick = 0.75 + 0.25 * Math.sin(G.menuT * 3 + l.phase);
    ctx.globalAlpha = 0.13 * flick;
    ctx.drawImage(lightSprite, l.x - 95, l.y - 95, 190, 190);
  }
  if (G.player && G.state !== 'menu') {
    ctx.globalAlpha = 0.11;
    ctx.drawImage(lightSprite, G.player.x - 120, G.player.y - 120, 240, 240);
  }
  ctx.restore();
}

function drawBloom() {
  if (!lightSprite) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const l of lamps) {
    if (Math.abs(l.x - G.camera.x) > 1200 || Math.abs(l.y - G.camera.y) > 1000) continue;
    const flick = 0.8 + 0.2 * Math.sin(G.menuT * 9 + l.phase);
    ctx.globalAlpha = 0.06 * flick;
    ctx.drawImage(lightSprite, l.x - 55, l.y - 55, 110, 110);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ menu */
function drawMenuScene() {
  const t = G.menuT;
  const cx = ARENA.w / 2, cy = ARENA.h / 2;
  // soft plaza pools
  if (lightSprite) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.16;
    ctx.drawImage(lightSprite, cx - 330, cy - 300, 660, 660);
    ctx.restore();
  }

  // mysterious cats in the rain
  const cats = [
    { x: cx - 360 + Math.sin(t * 0.4) * 8, y: cy + 240, a: -0.5, scale: 1 },
    { x: cx + 420, y: cy - 190, a: 2.5, scale: 0.9 },
    { x: cx + 300, y: cy + 330, a: 3.3, scale: 0.75 }
  ];
  for (const c of cats) {
    ctx.save();
    ctx.globalAlpha = 0.72;
    drawCat(c.x, c.y, c.a, c.scale, 0, false, true);
    ctx.restore();
  }

  // player, idling with a cigarette ember
  const bob = Math.sin(t * 1.6) * 1.8;
  const px = cx - 60, py = cy + 80 + bob;
  ctx.save();
  if (lightSprite) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.22;
    ctx.drawImage(lightSprite, px - 150, py - 150, 300, 300);
    ctx.globalCompositeOperation = 'source-over';
  }
  drawMouse(px, py, -0.5 + Math.sin(t * 0.5) * 0.06, 1, t, true);
  ctx.restore();

  // scattered cheese sparkles
  for (let i = 0; i < 5; i++) {
    const a = t * 0.25 + i * 1.3;
    const x = cx + Math.cos(a) * (240 + i * 28);
    const y = cy + Math.sin(a * 0.9) * 150;
    ctx.save();
    ctx.globalAlpha = 0.6;
    drawCheese(ctx, x, y, 15, a * 0.8, 0.9);
    ctx.restore();
  }

  // lamp bloom dots
  for (const l of lamps) {
    if (Math.abs(l.x - cx) > 900 || Math.abs(l.y - cy) > 750) continue;
    const r = 3 + Math.sin(t * 4 + l.phase) * 1;
    ctx.fillStyle = 'rgba(255,215,135,0.8)';
    ctx.beginPath(); ctx.arc(l.x, l.y, r, 0, TAU); ctx.fill();
  }
}

/* --------------------------------------------------------------- entities */
function drawSplats() {
  for (const s of G.splats) {
    const a = clamp(s.life / s.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * 0.55;
    for (const b of s.blobs) {
      ctx.fillStyle = '#4b0f12';
      ctx.beginPath();
      ctx.ellipse(s.x + b.dx, s.y + b.dy, b.rx, b.ry, b.a, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPickups() {
  const t = G.menuT;
  for (const u of G.pickups) {
    const bob = Math.sin(u.bob) * 3;
    const x = u.x, y = u.y + bob;
    ctx.save();
    if (u.kind === 'xp') {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#ffcf5a';
      ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      drawCheese(ctx, x, y, 14, Math.sin(u.bob * 0.7) * 0.15, 1);
    } else if (u.kind === 'super') {
      const pulse = 0.7 + Math.sin(t * 6) * 0.3;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.5 * pulse;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(x, y, 27, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 20 + pulse * 6, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      drawCheese(ctx, x, y, 27, Math.sin(t * 2) * 0.18, 1);
      drawStar(ctx, x + 16, y - 16, 4 + pulse * 2, '#ffe27a', 0.9);
    } else if (u.kind === 'weapon') {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#7fd4de';
      ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(t * 2) * 0.05);
      ctx.fillStyle = '#2a2b30';
      ctx.strokeStyle = '#7fd4de';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-16, -11, 32, 22);
      ctx.strokeRect(-16, -11, 32, 22);
      ctx.strokeStyle = 'rgba(233,185,73,0.65)';
      ctx.beginPath(); ctx.moveTo(-16, -2); ctx.lineTo(16, -2); ctx.stroke();
      ctx.fillStyle = '#e9b949';
      ctx.font = '900 15px "Arial Black", Impact, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 4);
      ctx.restore();
    } else if (u.kind === 'heart') {
      const pulse = 1 + Math.sin(t * 7) * 0.08;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ff5a4e';
      ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      drawHeart(ctx, x, y - 2, 15 * pulse, '#e6413b');
    }
    ctx.restore();
  }
}

function drawEntities() {
  const p = G.player;
  const list = [];
  for (const e of G.enemies) {
    if (e.dead) continue;
    list.push({ y: e.y + e.r, kind: 'enemy', e });
  }
  if (p && !p.dead) list.push({ y: p.y + p.r, kind: 'player' });
  else if (p && p.dead) list.push({ y: p.y + p.r - 100, kind: 'player' });
  list.sort((a, b) => a.y - b.y);

  for (const item of list) {
    if (item.kind === 'player') drawPlayerEntity();
    else drawEnemy(item.e);
  }
}

function drawPlayerEntity() {
  const p = G.player;
  if (!p) return;
  const t = G.menuT;
  if (!p.dead) {
    if (p.superTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const pulse = 0.75 + Math.sin(t * 9) * 0.25;
      const gr = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, 58);
      gr.addColorStop(0, `rgba(255,214,90,${0.25 * pulse})`);
      gr.addColorStop(0.6, `rgba(255,180,40,${0.1 * pulse})`);
      gr.addColorStop(1, 'rgba(255,160,20,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(p.x, p.y, 58, 0, TAU); ctx.fill();
      ctx.restore();
      if (Math.random() < 0.3) {
        const a = t * 3 + Math.random() * TAU;
        spawnParticles(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, '#ffd34d', 1, 22, 0.4, 2);
      }
    }
    drawMouse(p.x, p.y, p.aim, 1, t, false);
  } else {
    ctx.save();
    ctx.globalAlpha = 0.65;
    drawMouse(p.x, p.y, p.aim + 1.4, 1, t, false);
    ctx.restore();
  }
}

function drawMouse(x, y, angle, scale, t, menu) {
  const p = G.player;
  const blur = !menu && p && p.invuln > 0 && p.superTimer <= 0 && Math.floor(t * 18) % 2 === 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // shadow
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(-2, 10, 24, 9, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  if (blur) ctx.globalAlpha = 0.45;
  ctx.rotate(angle);

  // tail
  ctx.strokeStyle = '#a89174';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-13, 3);
  ctx.quadraticCurveTo(-32, 10 + Math.sin(t * 5) * 4, -36, -4 + Math.sin(t * 5) * 5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // coat
  ctx.fillStyle = '#9c8664';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#716049';
  ctx.beginPath();
  ctx.ellipse(-4, 4, 14, 10, 0, 0, TAU);
  ctx.fill();
  // warm rim light from the street lamps
  ctx.strokeStyle = 'rgba(255,218,152,0.28)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 14, 0, -2.55, 0.5);
  ctx.stroke();
  // coat lapels
  ctx.strokeStyle = 'rgba(35,28,20,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(3, -9); ctx.lineTo(8, 0); ctx.lineTo(3, 9);
  ctx.stroke();
  // shirt + tie
  ctx.fillStyle = '#d8cbb4';
  ctx.beginPath();
  ctx.moveTo(4, -3); ctx.lineTo(10, 0); ctx.lineTo(4, 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8f2e2a';
  ctx.beginPath();
  ctx.moveTo(5, -1.4); ctx.lineTo(15, 0); ctx.lineTo(5, 1.4);
  ctx.closePath(); ctx.fill();

  // ears
  ctx.fillStyle = '#9e8a6d';
  for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(-3, sy * 11, 5.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c69a91';
    ctx.beginPath();
    ctx.arc(-3, sy * 11, 2.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9e8a6d';
  }

  // head + snout
  ctx.fillStyle = '#c0ad8e';
  ctx.beginPath();
  ctx.ellipse(10, 0, 10.5, 8.5, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(19, 0.5, 7.5, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d9c9ad';
  ctx.beginPath();
  ctx.ellipse(18.5, 1.5, 5.4, 3.4, 0, 0, TAU);
  ctx.fill();
  // nose
  ctx.fillStyle = '#2a2020';
  ctx.beginPath();
  ctx.arc(25.5, 0.5, 2.1, 0, TAU);
  ctx.fill();
  // whiskers
  ctx.strokeStyle = 'rgba(230,220,200,0.42)';
  ctx.lineWidth = 0.8;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(22, s * 1.6); ctx.lineTo(32, s * 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(21, s * 1.2); ctx.lineTo(31, s * 2.2); ctx.stroke();
  }
  // eye
  ctx.fillStyle = '#171317';
  ctx.beginPath(); ctx.arc(12.5, -3.2, 1.7, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.arc(13, -3.7, 0.55, 0, TAU); ctx.fill();

  // fedora
  ctx.fillStyle = '#2f251c';
  ctx.beginPath();
  ctx.ellipse(6, 0, 14.5, 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3d3125';
  ctx.beginPath();
  ctx.ellipse(6, 0, 9.5, 7.4, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#b08a3e';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(6, 0, 10.4, 8.1, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.ellipse(2, -4, 4, 2, -0.4, 0, TAU); ctx.fill();

  // gun arm
  ctx.save();
  ctx.translate(6, 8);
  ctx.rotate(-0.18);
  ctx.strokeStyle = '#6d5b43';
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, 0); ctx.stroke();
  ctx.fillStyle = '#b3a082';
  ctx.beginPath(); ctx.arc(15, 0, 3.2, 0, TAU); ctx.fill();
  // handgun
  ctx.fillStyle = '#222027';
  ctx.fillRect(15, -3.6, 16, 4.6);
  ctx.fillStyle = '#3a3540';
  ctx.fillRect(16, -4.5, 8, 2);
  ctx.fillStyle = '#17151b';
  ctx.fillRect(15, -1.2, 5, 6.5);
  if (p && p.muzzle > 0 && !menu) {
    const ms = 1 - p.muzzle / 0.07;
    const a = p.superTimer > 0 ? '#ffe27a' : '#ffd27a';
    ctx.globalCompositeOperation = 'lighter';
    drawStar(ctx, 34, -1.2, 11 * (0.5 + ms * 0.8), a, 0.9);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(34, -1.2, 4.5 * (0.5 + ms), 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  // cigar ember
  if (p && p.cigar && !menu) {
    ctx.fillStyle = '#ff7a3d';
    ctx.beginPath(); ctx.arc(29, 4, 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,140,60,0.35)';
    ctx.beginPath(); ctx.arc(29, 4, 5, 0, TAU); ctx.fill();
  }

  ctx.restore();
}

function drawEnemy(e) {
  const angle = G.player ? angleTo(e.x, e.y, G.player.x, G.player.y) : e.wobble;
  if (e.isBoss) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const pulse = 0.8 + Math.sin(G.menuT * 4) * 0.2;
    const gr = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, 100);
    gr.addColorStop(0, `rgba(200,40,40,${0.18 * pulse})`);
    gr.addColorStop(1, 'rgba(120,10,20,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(e.x, e.y, 100, 0, TAU); ctx.fill();
    ctx.restore();
    drawCat(e.x, e.y, angle, 2.25, e.bob, true, false, e.flash > 0);
    drawEnemyHealth(e, 82, 74);
  } else if (e.type === 'cat') {
    drawCat(e.x, e.y, angle, 1, e.bob, false, false, e.flash > 0);
    drawEnemyHealth(e, 30, 24);
  } else {
    drawTrap(e.x, e.y, e.bob, e.flash > 0);
    drawEnemyHealth(e, 22, 18);
  }
}

function drawEnemyHealth(e, w, h) {
  if (e.hp >= e.maxHp) return;
  const pct = clamp(e.hp / e.maxHp, 0, 1);
  ctx.save();
  ctx.translate(e.x - w / 2, e.y - e.r - h);
  ctx.fillStyle = 'rgba(10,8,10,0.75)';
  ctx.fillRect(0, 0, w, 4);
  ctx.fillStyle = e.isBoss ? '#ff5a4e' : '#c8342f';
  ctx.fillRect(1, 1, (w - 2) * pct, 2);
  ctx.restore();
}

function drawCat(x, y, angle, scale, bob, boss, menu, flash) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 13, 24, 9, 0, 0, TAU);
  ctx.fill();

  ctx.rotate(angle);
  const walk = Math.sin(bob) * 2;

  // tail
  ctx.strokeStyle = boss ? '#3b3128' : '#1b1a1f';
  ctx.lineWidth = boss ? 3.5 : 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-15, 2);
  ctx.quadraticCurveTo(-30, -8 + Math.sin(bob) * 5, -37, 4 + Math.sin(bob) * 6);
  ctx.stroke();
  if (boss) {
    ctx.strokeStyle = 'rgba(233,185,73,0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // paws
  ctx.fillStyle = boss ? '#29241e' : '#111015';
  ctx.beginPath(); ctx.ellipse(4, -11, 5, 3.5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4, 11, 5, 3.5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9 - walk * 0.4, -10, 4.5, 3.2, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-9 + walk * 0.4, 10, 4.5, 3.2, 0, 0, TAU); ctx.fill();

  // body suit
  ctx.fillStyle = boss ? '#5c5040' : '#35313f';
  ctx.beginPath();
  ctx.ellipse(-1, 0, 18, 12.5, 0, 0, TAU);
  ctx.fill();
  // pinstripes
  ctx.strokeStyle = boss ? 'rgba(233,185,73,0.35)' : 'rgba(190,198,218,0.18)';
  ctx.lineWidth = 0.7;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-14, i * 3);
    ctx.lineTo(12, i * 3);
    ctx.stroke();
  }
  // tie
  ctx.fillStyle = boss ? '#b42323' : '#7d2328';
  ctx.beginPath();
  ctx.moveTo(9, -1.5); ctx.lineTo(17, 0); ctx.lineTo(9, 1.5);
  ctx.closePath(); ctx.fill();

  // head
  ctx.fillStyle = boss ? '#7a6a52' : '#3b3646';
  ctx.beginPath(); ctx.ellipse(15, 0, 10, 8.5, 0, 0, TAU); ctx.fill();
  // ears
  for (const s of [-1, 1]) {
    ctx.fillStyle = boss ? '#6a5a44' : '#322e3c';
    ctx.beginPath();
    ctx.moveTo(9, s * 7.5);
    ctx.lineTo(14, s * 15);
    ctx.lineTo(19, s * 7.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(200,120,120,0.25)';
    ctx.beginPath();
    ctx.moveTo(11.5, s * 8);
    ctx.lineTo(14, s * 12);
    ctx.lineTo(16.5, s * 8);
    ctx.closePath(); ctx.fill();
  }
  // muzzle
  ctx.fillStyle = boss ? '#d8c8a8' : '#b9b1a2';
  ctx.beginPath(); ctx.ellipse(21.5, 1, 5.5, 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#171419';
  ctx.beginPath(); ctx.ellipse(26, 0.5, 1.8, 1.4, 0, 0, TAU); ctx.fill();
  // rim light
  ctx.strokeStyle = boss ? 'rgba(255,180,120,0.18)' : 'rgba(175,200,225,0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(-1, 0, 18, 12.5, 0, -2.4, 0.8);
  ctx.stroke();
  // eyes
  const eyeColor = boss ? '#ff5a4e' : (menu ? '#e9b949' : '#ffd34d');
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = eyeColor;
  ctx.beginPath(); ctx.arc(16, -3.8, boss ? 7 : 4.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(16, 3.8, boss ? 7 : 4.5, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = eyeColor;
  ctx.beginPath(); ctx.ellipse(16, -3.8, 2.2, 1.5, 0.15, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, 3.8, 2.2, 1.5, -0.15, 0, TAU); ctx.fill();
  // tiny pupils
  ctx.fillStyle = '#151216';
  ctx.beginPath(); ctx.ellipse(16.7, -3.8, 0.8, 1.3, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16.7, 3.8, 0.8, 1.3, 0, 0, TAU); ctx.fill();

  // fedora
  ctx.fillStyle = boss ? '#241d18' : '#19171c';
  ctx.beginPath(); ctx.ellipse(10, 0, 13, 10.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = boss ? '#3a3026' : '#29252f';
  ctx.beginPath(); ctx.ellipse(10, 0, 8.5, 6.8, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = boss ? '#e9b949' : '#8f2e2a';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(10, 0, 9.2, 7.3, 0, 0, TAU); ctx.stroke();

  // tommy gun
  ctx.save();
  ctx.translate(2, 10);
  ctx.rotate(0.08);
  ctx.fillStyle = '#18151a';
  ctx.fillRect(0, -2, 18, 4);
  ctx.fillStyle = '#2b262e';
  ctx.fillRect(14, -1.5, 10, 3);
  ctx.fillStyle = '#3c343d';
  ctx.beginPath(); ctx.arc(4, 1, 3.4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#18151a';
  ctx.beginPath(); ctx.arc(4, 1, 1.3, 0, TAU); ctx.fill();
  ctx.restore();

  // boss chain + cigar
  if (boss) {
    ctx.strokeStyle = '#e9b949';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(4, 2, 7, 0.4, 2.3); ctx.stroke();
    ctx.fillStyle = '#e9b949';
    ctx.beginPath(); ctx.arc(2, 8, 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(25, 4, 8, 2);
    ctx.fillStyle = '#ff6b3d';
    ctx.beginPath(); ctx.arc(33, 5, 1.8, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,60,0.25)';
    ctx.beginPath(); ctx.arc(33, 5, 4, 0, TAU); ctx.fill();
  }

  if (flash) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(2, 0, 24, 17, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

function drawTrap(x, y, bob, flash) {
  ctx.save();
  ctx.translate(x, y);
  const squash = 1 + Math.sin(bob) * 0.035;
  ctx.scale(squash, 2 - squash);

  // shadow + threat glow
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(0, 11, 21, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(190,40,35,0.1)';
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();

  // metal base
  ctx.fillStyle = '#4a4b55';
  ctx.strokeStyle = '#5c5e68';
  ctx.lineWidth = 1.4;
  rr(ctx, -20, -12, 40, 24, 5);
  ctx.fill(); ctx.stroke();
  // wooden base hint
  ctx.fillStyle = '#2b241f';
  ctx.fillRect(-15, 5, 30, 4);
  // spring coil
  ctx.strokeStyle = '#8b8d98';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(-14 + i * 4, -9);
    ctx.quadraticCurveTo(-12 + i * 4, -3, -14 + i * 4, 2);
  }
  ctx.stroke();
  // jaw teeth
  ctx.strokeStyle = '#c9c9d1';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    ctx.moveTo(-15 + i * 5, -10);
    ctx.lineTo(-12 + i * 5, -5);
    ctx.lineTo(-15 + i * 5, -3);
  }
  ctx.stroke();
  // cheese bait
  drawCheese(ctx, 9, -6, 16, 0.2, 1);
  // glowing red eyes
  ctx.fillStyle = 'rgba(255,79,69,0.25)';
  ctx.beginPath(); ctx.arc(-10, -3, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff4f45';
  ctx.beginPath(); ctx.arc(-12, -3, 1.9, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-7, -3, 1.9, 0, TAU); ctx.fill();

  if (flash) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fff';
    rr(ctx, -20, -12, 40, 24, 5); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBullets() {
  ctx.save();
  for (const b of G.bullets) {
    const tx = b.x - b.vx * 0.025;
    const ty = b.y - b.vy * 0.025;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(b.color, 0.35);
    ctx.lineWidth = b.heavy ? 3.4 : 2;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill();
  }
  // boss corks
  for (const b of G.ebullets) {
    const tx = b.x - b.vx * 0.05;
    const ty = b.y - b.vy * 0.05;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(200,50,40,0.35)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.fillStyle = '#9c3b2c';
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 4.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d97a55';
    ctx.beginPath(); ctx.ellipse(-1, 0, 4, 2.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const q of G.particles) {
    const a = clamp(q.life / q.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = q.color;
    if (q.shape === 'square') {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.rot);
      ctx.fillRect(-q.size / 2, -q.size / 2, q.size, q.size);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * (0.4 + a * 0.6), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawTexts() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of G.texts) {
    const a = clamp(t.life / t.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `900 ${t.size}px "Arial Black", Impact, sans-serif`;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = t.size * 0.22;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

/* --------------------------------------------------------- screen overlay */
function drawScreenOverlay() {
  ctx.save();

  if (G.flashSky > 0) {
    ctx.fillStyle = `rgba(190,215,255,${G.flashSky * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (G.state !== 'menu' && G.player && G.player.superTimer > 0) {
    const p = 0.6 + Math.sin(G.menuT * 8) * 0.4;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(255,200,50,0)');
    g.addColorStop(1, `rgba(255,190,40,${0.1 * p})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (G.state !== 'menu' && G.player && G.player.hearts <= 2 && !G.player.dead) {
    const p = 0.55 + Math.sin(G.menuT * 5) * 0.45;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(160,10,10,0)');
    g.addColorStop(1, `rgba(160,10,10,${0.14 * p})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  if (G.boss && G.state !== 'menu') {
    const p = 0.5 + Math.sin(G.menuT * 4) * 0.5;
    ctx.strokeStyle = `rgba(200,40,40,${0.18 + p * 0.14})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
  }
  ctx.restore();
}
