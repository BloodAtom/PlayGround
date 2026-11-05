/* ============================================================================
   world: pre-rendered noir plaza, lighting sprites, drawing helpers
   ============================================================================ */

let worldCanvas = null;
let lightSprite = null;
let fogSprite = null;
const lamps = [];

function buildWorld() {
  const c = document.getElementById('bg');
  c.width = ARENA.w;
  c.height = ARENA.h;
  const g = c.getContext('2d');
  const rnd = mulberry32(20261105);
  const R = (a, b) => a + rnd() * (b - a);

  /* ---- base asphalt ---- */
  const grad = g.createRadialGradient(ARENA.w / 2, ARENA.h / 2, 120, ARENA.w / 2, ARENA.h / 2, 1850);
  grad.addColorStop(0, '#403f4a');
  grad.addColorStop(0.45, '#2f2f39');
  grad.addColorStop(1, '#1b1b23');
  g.fillStyle = grad;
  g.fillRect(0, 0, ARENA.w, ARENA.h);

  for (let i = 0; i < 9000; i++) {
    const a = rnd() * 0.05;
    g.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.3})`;
    g.fillRect(rnd() * ARENA.w, rnd() * ARENA.h, R(1, 4), R(1, 3));
  }

  /* ---- worn cobblestones: irregular slabs, soft joints, damp sheen ---- */
  const cw = 64, ch = 43;
  const stoneTones = [
    'rgba(92,92,109,0.30)', 'rgba(80,80,96,0.30)', 'rgba(68,68,83,0.32)',
    'rgba(104,101,116,0.23)', 'rgba(58,58,72,0.34)'
  ];
  for (let y = 44; y < ARENA.h - 44; y += ch) {
    const row = Math.floor(y / ch);
    for (let x = -cw; x < ARENA.w + cw; x += cw) {
      const ox = row % 2 ? cw / 2 : 0;
      const jx = R(-2.5, 2.5);
      const w = cw - 5 + R(-2, 2);
      const h = ch - 5 + R(-1.5, 1.5);
      const px = x + ox + 2 + jx;
      const py = y + 2 + R(-1.5, 1.5);
      g.fillStyle = stoneTones[Math.floor(rnd() * stoneTones.length)];
      g.beginPath();
      g.roundRect(px, py, w, h, R(5, 9));
      g.fill();
      // bevel: pale top edge, dark lower edge
      g.strokeStyle = 'rgba(255,255,255,0.035)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(px + 5, py + 1.2);
      g.lineTo(px + w - 7, py + 1.2);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.24)';
      g.beginPath();
      g.moveTo(px + 5, py + h - 1.4);
      g.lineTo(px + w - 5, py + h - 1.4);
      g.stroke();
      if (rnd() < 0.05) {
        g.strokeStyle = 'rgba(255,255,255,0.04)';
        g.beginPath();
        g.moveTo(px + 9, py + 8);
        g.quadraticCurveTo(px + w * 0.55, py + 7 + R(-3, 3), px + w - 8, py + 10 + R(-3, 3));
        g.stroke();
      }
      if (rnd() < 0.012) {
        g.strokeStyle = 'rgba(0,0,0,0.32)';
        g.beginPath();
        g.moveTo(px + w * 0.35, py + 3);
        g.lineTo(px + w * 0.48, py + h * 0.52);
        g.lineTo(px + w * 0.4, py + h - 3);
        g.stroke();
      }
    }
  }
  // rain-slick sheen across the plaza
  const sheen = g.createLinearGradient(0, 0, ARENA.w, ARENA.h);
  sheen.addColorStop(0, 'rgba(135,160,185,0.035)');
  sheen.addColorStop(0.5, 'rgba(135,160,185,0.00)');
  sheen.addColorStop(1, 'rgba(115,140,165,0.035)');
  g.fillStyle = sheen;
  g.fillRect(46, 46, ARENA.w - 92, ARENA.h - 92);

  /* ---- central plaza mosaic ---- */
  const cx = ARENA.w / 2, cy = ARENA.h / 2;
  g.save();
  g.translate(cx, cy);
  // broad warm pool under the plaza lamps
  const pool = g.createRadialGradient(0, 0, 40, 0, 0, 760);
  pool.addColorStop(0, 'rgba(233,185,73,0.075)');
  pool.addColorStop(0.42, 'rgba(233,185,73,0.035)');
  pool.addColorStop(1, 'rgba(233,185,73,0)');
  g.fillStyle = pool;
  g.beginPath(); g.arc(0, 0, 760, 0, TAU); g.fill();
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(0, 0, 340 - i * 34, 0, TAU);
    g.strokeStyle = i === 0 ? 'rgba(233,185,73,0.20)' : 'rgba(242,231,207,0.075)';
    g.lineWidth = i === 0 ? 3 : 1.5;
    g.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a) * 356, Math.sin(a) * 356);
    g.lineTo(Math.cos(a) * 384, Math.sin(a) * 384);
    g.strokeStyle = 'rgba(242,231,207,0.075)';
    g.lineWidth = 2;
    g.stroke();
  }
  // faded cheese emblem
  g.globalAlpha = 0.72;
  drawCheese(g, 0, 10, 150, -0.15, 0.05);
  g.globalAlpha = 1;
  g.restore();

  /* ---- border sidewalks ---- */
  const walk = 150;
  g.fillStyle = '#32313b';
  g.fillRect(46, 46, ARENA.w - 92, walk - 46);
  g.fillRect(46, ARENA.h - walk, ARENA.w - 92, walk - 46);
  g.fillRect(46, walk, walk - 46, ARENA.h - walk * 2);
  g.fillRect(ARENA.w - walk, walk, walk - 46, ARENA.h - walk * 2);
  // sidewalk tiles
  g.strokeStyle = 'rgba(0,0,0,0.28)';
  g.lineWidth = 1;
  for (let x = 46; x < ARENA.w - 46; x += 52) {
    g.beginPath(); g.moveTo(x, 46); g.lineTo(x, walk); g.stroke();
    g.beginPath(); g.moveTo(x, ARENA.h - walk); g.lineTo(x, ARENA.h - 46); g.stroke();
  }
  for (let y = 46; y < ARENA.h - 46; y += 52) {
    g.beginPath(); g.moveTo(46, y); g.lineTo(walk, y); g.stroke();
    g.beginPath(); g.moveTo(ARENA.w - walk, y); g.lineTo(ARENA.w - 46, y); g.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const edge = rnd() > 0.5;
    const x = edge ? R(48, walk) : R(ARENA.w - walk, ARENA.w - 48);
    const y = R(48, ARENA.h - 48);
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.025})`;
    g.fillRect(x, y, R(2, 7), R(2, 7));
  }
  // curbs
  g.strokeStyle = 'rgba(120,118,128,0.35)';
  g.lineWidth = 4;
  g.strokeRect(walk, walk, ARENA.w - walk * 2, ARENA.h - walk * 2);
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 2;
  g.strokeRect(walk + 4, walk + 4, ARENA.w - walk * 2 - 8, ARENA.h - walk * 2 - 8);

  /* ---- boundary walls ---- */
  const wall = 46;
  g.fillStyle = '#211a20';
  g.fillRect(0, 0, ARENA.w, wall);
  g.fillRect(0, ARENA.h - wall, ARENA.w, wall);
  g.fillRect(0, 0, wall, ARENA.h);
  g.fillRect(ARENA.w - wall, 0, wall, ARENA.h);
  // bricks
  for (let y = 0; y < wall; y += 13) {
    for (let x = -20; x < ARENA.w; x += 54) {
      const ox = (y / 13) % 2 ? 27 : 0;
      g.fillStyle = `rgba(${58 + rnd() * 22},${40 + rnd() * 16},${44 + rnd() * 18},${0.45 + rnd() * 0.3})`;
      g.fillRect(x + ox, y + 1, 51, 11);
      if (x + ox < ARENA.w - 60) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x + ox + 51, y + 1, 2, 11);
      }
    }
  }
  // inner wall lip
  g.strokeStyle = 'rgba(233,185,73,0.16)';
  g.lineWidth = 2;
  g.strokeRect(wall, wall, ARENA.w - wall * 2, ARENA.h - wall * 2);

  /* ---- neon signs on walls ---- */
  const signs = [
    { x: 420, y: 24, text: 'BAR', color: '#ff5a4e' },
    { x: 1200, y: 24, text: 'HOTEL', color: '#7fd4de' },
    { x: 1980, y: 24, text: 'QUEIJO', color: '#e9b949' },
    { x: 2650, y: 24, text: '24H', color: '#b07cff' },
    { x: 300, y: ARENA.h - 26, text: 'GATTO', color: '#ff5a4e' },
    { x: 1450, y: ARENA.h - 26, text: 'MAFIA', color: '#e9b949' },
    { x: 2450, y: ARENA.h - 26, text: 'FORMAGGIO', color: '#7fd4de' },
    { x: 22, y: 760, text: 'CLUB', color: '#b07cff', vert: true },
    { x: ARENA.w - 22, y: 1450, text: 'NOIR', color: '#ff5a4e', vert: true }
  ];
  for (const s of signs) {
    g.save();
    g.translate(s.x, s.y);
    if (s.vert) g.rotate(-Math.PI / 2);
    g.font = '700 18px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = s.color;
    g.shadowBlur = 16;
    g.fillStyle = s.color;
    g.fillText(s.text, 0, 0);
    g.shadowBlur = 0;
    g.globalAlpha = 0.35;
    g.strokeStyle = 'rgba(0,0,0,0.9)';
    g.lineWidth = 4;
    g.strokeText(s.text, 0, 0);
    g.restore();
  }

  /* ---- puddles ---- */
  for (let i = 0; i < 26; i++) {
    const x = R(240, ARENA.w - 240);
    const y = R(240, ARENA.h - 240);
    const rx = R(28, 105), ry = rx * R(0.28, 0.55);
    const pg = g.createRadialGradient(x, y, 1, x, y, rx);
    pg.addColorStop(0, `rgba(105,145,170,${R(0.10, 0.2)})`);
    pg.addColorStop(0.65, `rgba(50,80,100,${R(0.06, 0.12)})`);
    pg.addColorStop(1, 'rgba(20,30,40,0)');
    g.save();
    g.translate(x, y);
    g.rotate(R(-0.4, 0.4));
    g.fillStyle = pg;
    g.beginPath();
    g.ellipse(0, 0, rx, ry, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(170,210,230,0.07)';
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = 'rgba(210,235,255,0.10)';
    g.fillRect(-rx * 0.3, -ry * 0.3, rx * 0.5, 2);
    g.restore();
  }

  /* ---- manholes ---- */
  const manholes = [
    [760, 560], [2260, 1560], [2450, 530], [620, 1640], [1500, 260],
    [1500, 1850], [2850, 1050], [160, 1050], [1200, 1160], [1920, 900]
  ];
  for (const [x, y] of manholes) {
    g.fillStyle = '#19181d';
    g.beginPath(); g.arc(x, y, 29, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(150,140,125,0.28)';
    g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 21, 0, TAU); g.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      g.fillStyle = 'rgba(140,130,118,0.22)';
      g.beginPath();
      g.arc(x + Math.cos(a) * 14, y + Math.sin(a) * 14, 2.2, 0, TAU);
      g.fill();
    }
  }

  /* ---- debris / paper ---- */
  for (let i = 0; i < 110; i++) {
    const x = R(180, ARENA.w - 180), y = R(180, ARENA.h - 180);
    g.save();
    g.translate(x, y);
    g.rotate(R(0, TAU));
    g.fillStyle = `rgba(${R(120, 200)},${R(115, 190)},${R(100, 170)},${R(0.06, 0.16)})`;
    g.fillRect(-R(2, 7), -R(1, 4), R(4, 12), R(2, 6));
    g.restore();
  }
  // shell casings
  for (let i = 0; i < 90; i++) {
    g.save();
    g.translate(R(200, ARENA.w - 200), R(200, ARENA.h - 200));
    g.rotate(R(0, TAU));
    g.fillStyle = 'rgba(210,170,80,0.22)';
    g.fillRect(0, 0, 4, 1.6);
    g.restore();
  }

  /* ---- props: crates, barrels, bins ---- */
  const props = [
    [260, 520], [360, 1480], [270, 980], [2680, 640], [2760, 1720], [2680, 1050],
    [860, 300], [2180, 280], [880, 1810], [2140, 1820], [560, 700], [2440, 1380],
    [1750, 380], [1300, 1740], [700, 1240], [2380, 820],
    [1010, 820], [1990, 820], [1010, 1300], [1990, 1300],
    [1220, 600], [1780, 1520], [580, 1080], [2420, 1060]
  ];
  for (let i = 0; i < props.length; i++) {
    const [x, y] = props[i];
    if (i % 3 === 0) {
      g.save();
      g.translate(x, y);
      g.rotate(R(-0.3, 0.3));
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(4, 12, 30, 12, 0, 0, TAU); g.fill();
      g.fillStyle = '#3c2d20';
      g.fillRect(-24, -18, 48, 36);
      g.strokeStyle = '#57432e'; g.lineWidth = 3;
      g.strokeRect(-24, -18, 48, 36);
      g.beginPath(); g.moveTo(-24, -18); g.lineTo(24, 18); g.moveTo(24, -18); g.lineTo(-24, 18); g.stroke();
      g.fillStyle = 'rgba(233,185,73,0.18)';
      g.fillRect(-20, 12, 40, 3);
      g.restore();
    } else if (i % 3 === 1) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath(); g.ellipse(x + 3, y + 13, 19, 8, 0, 0, TAU); g.fill();
      g.fillStyle = '#2d3136';
      g.beginPath(); g.arc(x, y, 17, 0, TAU); g.fill();
      g.strokeStyle = '#4b535a'; g.lineWidth = 2.5; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y, 10, 0, TAU); g.stroke();
      g.beginPath(); g.arc(x, y, 4, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(233,185,73,0.22)';
      g.fillRect(x - 9, y - 4, 18, 3);
    } else {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(x + 2, y + 10, 22, 9, 0, 0, TAU); g.fill();
      g.fillStyle = '#18191b';
      g.beginPath();
      g.moveTo(x - 18, y + 10);
      g.quadraticCurveTo(x - 22, y - 12, x - 8, y - 17);
      g.quadraticCurveTo(x + 8, y - 24, x + 16, y - 8);
      g.quadraticCurveTo(x + 22, y + 8, x + 12, y + 12);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 2; g.stroke();
    }
  }

  /* ---- dried blood ---- */
  for (let i = 0; i < 9; i++) {
    const x = R(300, ARENA.w - 300), y = R(300, ARENA.h - 300);
    g.fillStyle = `rgba(70,14,16,${R(0.08, 0.16)})`;
    for (let j = 0; j < 6; j++) {
      g.beginPath();
      g.ellipse(x + R(-30, 30), y + R(-20, 20), R(3, 14), R(2, 8), R(0, TAU), 0, TAU);
      g.fill();
    }
  }

  /* ---- lamp posts ---- */
  const lampPositions = [
    [330, 330], [1500, 205], [2670, 330], [2790, 1050], [2670, 1770],
    [1500, 1900], [330, 1770], [210, 1050], [840, 700], [2160, 700],
    [2160, 1400], [840, 1400],
    [1130, 760], [1870, 760], [1870, 1340], [1130, 1340]
  ];
  for (const [x, y] of lampPositions) {
    lamps.push({ x, y, phase: rnd() * TAU });
    // wet asphalt reflection under the lamp
    g.save();
    g.globalCompositeOperation = 'screen';
    const refl = g.createLinearGradient(x, y + 8, x, y + 185);
    refl.addColorStop(0, 'rgba(255,196,94,0.16)');
    refl.addColorStop(0.45, 'rgba(255,178,70,0.045)');
    refl.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = refl;
    g.beginPath();
    g.moveTo(x - 8, y + 8);
    g.lineTo(x + 8, y + 8);
    g.lineTo(x + 30, y + 180);
    g.lineTo(x - 22, y + 180);
    g.closePath();
    g.fill();
    g.restore();

    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath(); g.ellipse(x + 4, y + 8, 15, 8, 0, 0, TAU); g.fill();
    g.fillStyle = '#15151a';
    g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(233,185,73,0.5)';
    g.lineWidth = 2.5; g.stroke();
    g.fillStyle = 'rgba(255,217,130,0.9)';
    g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(180,150,90,0.22)';
    g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, 15, 0, TAU); g.stroke();
  }

  worldCanvas = c;

  /* ---- light sprite ---- */
  lightSprite = document.createElement('canvas');
  lightSprite.width = lightSprite.height = 512;
  const lg = lightSprite.getContext('2d');
  const lgr = lg.createRadialGradient(256, 256, 0, 256, 256, 256);
  lgr.addColorStop(0, 'rgba(255,202,104,0.55)');
  lgr.addColorStop(0.28, 'rgba(255,180,80,0.20)');
  lgr.addColorStop(0.62, 'rgba(255,150,60,0.055)');
  lgr.addColorStop(1, 'rgba(255,140,50,0)');
  lg.fillStyle = lgr;
  lg.fillRect(0, 0, 512, 512);

  /* ---- fog sprite ---- */
  fogSprite = document.createElement('canvas');
  fogSprite.width = fogSprite.height = 512;
  const fg = fogSprite.getContext('2d');
  const fgr = fg.createRadialGradient(256, 256, 0, 256, 256, 256);
  fgr.addColorStop(0, 'rgba(170,190,205,0.22)');
  fgr.addColorStop(0.5, 'rgba(150,170,190,0.07)');
  fgr.addColorStop(1, 'rgba(150,170,190,0)');
  fg.fillStyle = fgr;
  fg.fillRect(0, 0, 512, 512);

  /* bake warm light pools into the static layer for performance */
  g.save();
  g.globalCompositeOperation = 'screen';
  for (const l of lamps) {
    g.globalAlpha = 0.68;
    g.drawImage(lightSprite, l.x - 235, l.y - 235, 470, 470);
  }
  g.restore();
}

/* --------------------------------------------------------------- helpers */
function drawCheese(g, x, y, s, rot = 0, alpha = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.globalAlpha *= alpha;
  g.beginPath();
  g.moveTo(-s * 0.52, s * 0.42);
  g.lineTo(s * 0.52, s * 0.42);
  g.lineTo(s * 0.46, -s * 0.08);
  g.lineTo(-s * 0.2, -s * 0.52);
  g.closePath();
  const cg = g.createLinearGradient(-s * 0.5, -s * 0.5, s * 0.5, s * 0.5);
  cg.addColorStop(0, '#ffe08a');
  cg.addColorStop(0.55, '#f2be3e');
  cg.addColorStop(1, '#c98a17');
  g.fillStyle = cg;
  g.fill();
  g.strokeStyle = '#8a5c0e';
  g.lineWidth = Math.max(1.5, s * 0.06);
  g.stroke();
  g.fillStyle = 'rgba(120,76,8,0.75)';
  g.beginPath(); g.arc(-s * 0.22, s * 0.14, s * 0.09, 0, TAU); g.fill();
  g.beginPath(); g.arc(s * 0.14, s * 0.22, s * 0.065, 0, TAU); g.fill();
  g.beginPath(); g.arc(s * 0.21, -s * 0.06, s * 0.05, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.moveTo(-s * 0.38, s * 0.28);
  g.lineTo(s * 0.3, s * 0.28);
  g.lineTo(s * 0.26, s * 0.18);
  g.lineTo(-s * 0.34, s * 0.18);
  g.closePath(); g.fill();
  g.restore();
}

function drawHeart(g, x, y, s, color = '#e6413b') {
  g.save();
  g.translate(x, y);
  g.beginPath();
  g.moveTo(0, s * 0.34);
  g.bezierCurveTo(-s * 0.9, -s * 0.16, -s * 0.52, -s * 0.76, 0, -s * 0.32);
  g.bezierCurveTo(s * 0.52, -s * 0.76, s * 0.9, -s * 0.16, 0, s * 0.34);
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = Math.max(1, s * 0.07);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.beginPath();
  g.ellipse(-s * 0.2, -s * 0.28, s * 0.12, s * 0.07, -0.5, 0, TAU);
  g.fill();
  g.restore();
}

function drawStar(g, x, y, r, color, alpha = 1) {
  g.save();
  g.translate(x, y);
  g.globalAlpha *= alpha;
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const rr = i % 2 === 0 ? r : r * 0.32;
    if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.restore();
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
