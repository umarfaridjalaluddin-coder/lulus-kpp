// Animated 2D road scene (side view, slightly elevated camera).
// Left-hand traffic: the player travels to the right in the far lane (the
// driver's left), oncoming traffic uses the near lane. The scene only reacts
// to quiz state; it never decides anything about answers or scores.

const TAU = Math.PI * 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function hash(n) { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

export const ENV_STYLE = {
  perumahan: { sky: ['#9FD3F2', '#DDF1FB'], ground: '#8DBF5B', far: '#7DA95A', night: false, rain: false, road: '#545A61' },
  bandar: { sky: ['#A9CFEA', '#E6F2F8'], ground: '#9CB98A', far: '#90A4B6', night: false, rain: false, road: '#50565D' },
  luarbandar: { sky: ['#8ECDF0', '#E3F4FB'], ground: '#79B354', far: '#5E9A55', night: false, rain: false, road: '#5A5F64' },
  lebuhraya: { sky: ['#9CCBEA', '#E8F3F8'], ground: '#86B45E', far: '#7EA06A', night: false, rain: false, road: '#4C5258', highway: true },
  malam: { sky: ['#0B1A33', '#243B63'], ground: '#1E3A2B', far: '#16273D', night: true, rain: false, road: '#2E3338' },
  hujan: { sky: ['#7E8B98', '#B9C3CC'], ground: '#5F8A52', far: '#6C7F8E', night: false, rain: true, road: '#3E4449' },
};

export class RoadScene {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.vehicle = opts.vehicle || { type: 'car', color: '#0C807C' };
    this.env = opts.env || 'perumahan';
    this.motion = opts.motion || 'full';
    this.pos = 0; // world x of the player's vehicle
    this.wheel = 0;
    this.speed = 0;
    this.checkpoint = null; // { x, label }
    this.finish = null; // { x, kind: 'arrive'|'learn' }
    this.oncoming = [];
    this.rain = [];
    this.confetti = [];
    this.raf = 0;
    this.anim = null;
    this.sprites = new Map();
    this.onResize = () => this.resize();
    this.resize();
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(this.onResize); this.ro.observe(canvas); }
    this.draw();
  }

  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; this.ro?.disconnect(); this.anim = null; }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this.W = Math.max(200, Math.round(r.width || 360));
    this.H = Math.max(120, Math.round(r.height || 190));
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;
    this.layout();
    if (!this.raf) this.draw();
  }

  layout() {
    const H = this.H;
    const hw = ENV_STYLE[this.env].highway;
    this.horizon = H * 0.36;
    this.roadTop = H * (hw ? 0.5 : 0.56);
    this.roadBot = H * 0.9;
    this.scale = Math.min(1.25, H / 190);
    this.vx = Math.min(this.W * 0.3, 150); // screen x of the vehicle's centre
    const lane = (this.roadBot - this.roadTop) / (hw ? 4.4 : 2);
    this.laneY = this.roadTop + lane * (hw ? 0.9 : 0.78); // player's wheel line (far lane)
    this.oncomingY = this.roadBot - lane * (hw ? 0.6 : 0.3);
  }

  setVehicle(v) { this.vehicle = v; this.draw(); }

  /** Slow continuous drive (home screen). Stops with stopCruise() or when motion is static. */
  cruise(pxPerSec = 40) {
    if (this.motion === 'static') { this.draw(); return; }
    this.cruiseSpeed = pxPerSec;
    this.loop();
  }
  stopCruise() { this.cruiseSpeed = 0; }
  setEnv(env) { if (env !== this.env) { this.env = env; this.rain = []; this.layout(); this.draw(); } }
  setMotion(m) { this.motion = m; if (m === 'static') { this.finishAnim(); this.cruiseSpeed = 0; this.confetti = []; } this.draw(); }

  /** Place a checkpoint ahead and drive to it. Resolves when the vehicle has stopped. */
  driveToCheckpoint(label) {
    const dist = Math.max(360, this.W * 1.15);
    this.checkpoint = { x: this.pos + dist, label };
    return this.moveTo(this.pos + dist, 2100);
  }

  /** Results: drive up to a destination gate (pass) or a learning checkpoint (not yet). */
  driveToFinish(kind) {
    const dist = Math.max(300, this.W * 0.9);
    this.checkpoint = null;
    this.finish = { x: this.pos + dist, kind };
    return this.moveTo(this.pos + dist, 1800).then(() => { if (kind === 'arrive' && this.motion === 'full') this.celebrate(); });
  }

  moveTo(target, ms) {
    this.finishAnim();
    if (this.motion === 'static' || document.hidden) {
      this.pos = target; this.speed = 0; this.draw();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const from = this.pos;
      const start = performance.now();
      this.anim = { resolve, from, target, start, ms, last: start };
      this.loop();
    });
  }

  finishAnim() {
    if (!this.anim) return;
    const a = this.anim;
    this.anim = null;
    this.pos = a.target; this.speed = 0;
    a.resolve();
  }

  celebrate() {
    for (let i = 0; i < 46; i++) {
      this.confetti.push({ x: this.vx + 60 + (hash(i) - 0.5) * 220, y: -10 - hash(i + 9) * 80, vy: 40 + hash(i + 3) * 50, vx: (hash(i + 5) - 0.5) * 30, r: 2.5 + hash(i + 7) * 2.5, c: ['#F2A900', '#3BC2B9', '#FFFFFF', '#F37C6B'][i % 4], life: 1.9 });
    }
    this.confettiStart = performance.now();
    this.loop();
  }

  loop() {
    if (this.raf) return;
    const step = (t) => {
      this.raf = 0;
      let busy = false;
      const now = t;
      if (this.anim) {
        const a = this.anim;
        const k = Math.min(1, (now - a.start) / a.ms);
        const p = a.from + (a.target - a.from) * ease(k);
        const dt = Math.max(1, now - a.last) / 1000;
        this.speed = (p - this.pos) / dt;
        this.pos = p;
        a.last = now;
        this.updateTraffic(dt);
        if (k >= 1) { this.anim = null; this.speed = 0; a.resolve(); } else busy = true;
      }
      if (this.cruiseSpeed && !this.anim) {
        const dt = Math.min(0.05, (now - (this.lastCruise || now)) / 1000);
        this.lastCruise = now;
        this.speed = this.cruiseSpeed;
        this.pos += this.cruiseSpeed * dt;
        this.updateTraffic(dt);
        busy = true;
      } else this.lastCruise = 0;
      if (this.confetti.length) {
        const dt = 1 / 60;
        for (const c of this.confetti) { c.y += c.vy * dt; c.x += c.vx * dt; c.life -= dt; }
        this.confetti = this.confetti.filter((c) => c.life > 0 && c.y < this.H + 10);
        if (this.confetti.length) busy = true;
      }
      this.draw();
      if (busy) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  updateTraffic(dt) {
    const st = ENV_STYLE[this.env];
    // Oncoming vehicles move left on screen at their own speed plus the camera motion.
    for (const o of this.oncoming) o.sx -= (o.v + this.speed) * dt;
    this.oncoming = this.oncoming.filter((o) => o.sx > -140);
    this.nextSpawn = (this.nextSpawn ?? 0.6) - dt;
    if (this.nextSpawn <= 0 && this.oncoming.length < 2) {
      this.oncoming.push({ sx: this.W + 120, v: 70 + Math.random() * 50, color: ['#D9DEE3', '#3D5A80', '#B33A3A', '#E0B33A', '#2F3E46'][Math.floor(Math.random() * 5)], moto: Math.random() < 0.3 });
      this.nextSpawn = 2.2 + Math.random() * 2.5;
    }
    if (st.rain) {
      while (this.rain.length < 70) this.rain.push({ x: Math.random() * this.W, y: Math.random() * this.H, l: 8 + Math.random() * 8 });
      for (const r of this.rain) { r.y += 380 * dt; r.x -= (60 + this.speed * 0.2) * dt; if (r.y > this.H) { r.y = -10; r.x = Math.random() * (this.W + 40); } }
    }
  }

  // ------------------------------------------------------------ drawing
  draw() {
    const { ctx, W, H } = this;
    if (!W) return;
    const st = ENV_STYLE[this.env];
    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, this.roadTop);
    sky.addColorStop(0, st.sky[0]); sky.addColorStop(1, st.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, this.roadTop + 2);
    if (st.night) this.drawStars(); else this.drawSunClouds(st);
    this.drawFar(st);
    this.drawMid(st);
    this.drawRoad(st);
    this.drawMarkers(st);
    this.drawOncoming(st);
    this.drawPlayer(st);
    this.drawForeground(st);
    if (st.rain) this.drawRain();
    if (st.night) { ctx.fillStyle = 'rgba(5,12,28,0.18)'; ctx.fillRect(0, 0, W, H); }
    for (const c of this.confetti) { ctx.globalAlpha = Math.min(1, c.life); ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  sx(worldX, f) { return worldX - this.pos * f + this.vx; }

  drawStars() {
    const { ctx, W } = this;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 40; i++) { const x = ((hash(i) * W * 1.3) - this.pos * 0.01) % W; ctx.fillRect((x + W) % W, hash(i + 50) * this.horizon * 0.9, 1.6, 1.6); }
    ctx.fillStyle = '#F4F1D6'; ctx.beginPath(); ctx.arc(W * 0.82, this.horizon * 0.35, 13 * this.scale, 0, TAU); ctx.fill();
    ctx.fillStyle = ENV_STYLE.malam.sky[0]; ctx.beginPath(); ctx.arc(W * 0.82 + 6, this.horizon * 0.33, 11 * this.scale, 0, TAU); ctx.fill();
  }

  drawSunClouds(st) {
    const { ctx, W } = this;
    if (!st.rain) { ctx.fillStyle = 'rgba(255,236,170,0.9)'; ctx.beginPath(); ctx.arc(W * 0.84, this.horizon * 0.42, 16 * this.scale, 0, TAU); ctx.fill(); }
    ctx.fillStyle = st.rain ? 'rgba(120,132,145,0.85)' : 'rgba(255,255,255,0.9)';
    const span = 260;
    const off = this.pos * 0.04;
    for (let i = Math.floor((off - 100) / span); i < (off + W + 200) / span; i++) {
      const x = i * span + hash(i) * 120 - off;
      const y = this.horizon * (0.2 + hash(i + 3) * 0.45);
      const s = (0.7 + hash(i + 5) * 0.6) * this.scale;
      ctx.beginPath(); ctx.ellipse(x, y, 34 * s, 11 * s, 0, 0, TAU); ctx.ellipse(x + 18 * s, y - 7 * s, 20 * s, 11 * s, 0, 0, TAU); ctx.ellipse(x - 16 * s, y - 4 * s, 16 * s, 9 * s, 0, 0, TAU); ctx.fill();
    }
  }

  drawFar(st) {
    const { ctx, W } = this;
    const base = this.roadTop - 4 * this.scale;
    const f = 0.12;
    ctx.fillStyle = st.far;
    if (this.env === 'bandar' || this.env === 'malam') {
      const span = 46 * this.scale;
      const off = this.pos * f;
      for (let i = Math.floor(off / span) - 1; i < (off + W) / span + 1; i++) {
        const h = (40 + hash(i) * 60) * this.scale; const w = span * (0.7 + hash(i + 1) * 0.5);
        const x = i * span - off;
        ctx.fillRect(x, base - h - 14 * this.scale, w, h + 14 * this.scale);
        if (st.night) { ctx.fillStyle = 'rgba(255,214,120,0.75)'; for (let k = 0; k < 6; k++) if (hash(i * 13 + k) > 0.45) ctx.fillRect(x + 5 + (k % 2) * (w / 2 - 2), base - h + (k >> 1) * 12 * this.scale, 5, 6); ctx.fillStyle = st.far; }
      }
    } else {
      ctx.beginPath(); ctx.moveTo(0, base);
      for (let x = 0; x <= W + 10; x += 10) {
        const wx = x + this.pos * f;
        const y = base - (26 + Math.sin(wx * 0.012) * 14 + Math.sin(wx * 0.031 + 1) * 8) * this.scale;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, base); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = st.ground; ctx.fillRect(0, base - 2, W, this.roadTop - base + 4);
  }

  drawMid(st) {
    const { ctx, W } = this;
    const f = 0.45;
    const base = this.roadTop - 2;
    const span = 70 * this.scale;
    const off = this.pos * f;
    for (let i = Math.floor(off / span) - 2; i < (off + W) / span + 2; i++) {
      const x = i * span - off + hash(i) * 20;
      const kind = this.midKind(i);
      if (!kind) continue;
      const img = this.sprite(kind, st);
      const w = img.width / this.dpr, h = img.height / this.dpr;
      ctx.drawImage(img, x, base - h, w, h);
    }
  }

  midKind(i) {
    const r = hash(i + 101);
    switch (this.env) {
      case 'perumahan': return r < 0.55 ? `house${Math.floor(hash(i) * 3)}` : r < 0.85 ? 'tree' : null;
      case 'bandar': return r < 0.6 ? `shop${Math.floor(hash(i) * 3)}` : r < 0.8 ? 'tree' : null;
      case 'luarbandar': return r < 0.55 ? 'palm' : r < 0.7 ? 'kampung' : r < 0.85 ? 'tree' : null;
      case 'lebuhraya': return r < 0.35 ? 'tree' : r < 0.5 ? 'palm' : null;
      case 'malam': return r < 0.5 ? `house${Math.floor(hash(i) * 3)}` : r < 0.75 ? 'tree' : null;
      case 'hujan': return r < 0.45 ? `shop${Math.floor(hash(i) * 3)}` : r < 0.75 ? 'tree' : null;
      default: return null;
    }
  }

  sprite(kind, st) {
    const key = `${kind}|${this.env}|${this.scale.toFixed(2)}|${this.dpr}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const s = this.scale;
    const dims = { house0: [64, 52], house1: [64, 52], house2: [64, 52], shop0: [58, 84], shop1: [58, 70], shop2: [58, 96], tree: [44, 60], palm: [52, 66], kampung: [62, 50], lamp: [30, 74], rail: [80, 20], cp: [64, 74], gate: [120, 96], learn: [76, 74] }[kind];
    c = document.createElement('canvas');
    c.width = Math.ceil(dims[0] * s * this.dpr); c.height = Math.ceil(dims[1] * s * this.dpr);
    const g = c.getContext('2d');
    g.scale(this.dpr * s, this.dpr * s);
    drawSprite(g, kind, dims, st);
    this.sprites.set(key, c);
    return c;
  }

  drawRoad(st) {
    const { ctx, W } = this;
    const hw = st.highway;
    // far kerb / pavement
    ctx.fillStyle = st.night ? '#3B4250' : '#C9CDD1';
    ctx.fillRect(0, this.roadTop - 5 * this.scale, W, 5 * this.scale);
    ctx.fillStyle = st.road;
    ctx.fillRect(0, this.roadTop, W, this.roadBot - this.roadTop);
    if (st.rain) { const g = ctx.createLinearGradient(0, this.roadTop, 0, this.roadBot); g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.5, 'rgba(200,220,240,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0.03)'); ctx.fillStyle = g; ctx.fillRect(0, this.roadTop, W, this.roadBot - this.roadTop); }
    // edge lines (continuous white)
    ctx.fillStyle = '#F4F4F4';
    ctx.fillRect(0, this.roadTop + 3, W, 2.2);
    ctx.fillRect(0, this.roadBot - 5, W, 2.2);
    const dash = (y, len, gap) => {
      const span = len + gap; const off = this.pos % span;
      for (let x = -off; x < W; x += span) ctx.fillRect(x, y, len, 2.2);
    };
    if (hw) {
      const h = this.roadBot - this.roadTop;
      const midTop = this.roadTop + h * 0.47, midBot = this.roadTop + h * 0.56;
      ctx.fillStyle = '#7C8A6A'; ctx.fillRect(0, midTop, W, midBot - midTop); // median
      ctx.fillStyle = '#F4F4F4'; ctx.fillRect(0, midTop - 3, W, 2); ctx.fillRect(0, midBot + 1, W, 2);
      dash(this.roadTop + (midTop - this.roadTop) / 2, 22, 26);
      dash(midBot + (this.roadBot - midBot) / 2, 22, 26);
      // guardrail on the median
      ctx.fillStyle = '#B9C1C8'; ctx.fillRect(0, midTop + (midBot - midTop) * 0.35, W, 3);
      const span = 30; const off = this.pos % span;
      for (let x = -off; x < W; x += span) ctx.fillRect(x, midTop + (midBot - midTop) * 0.2, 2, (midBot - midTop) * 0.55);
    } else {
      dash((this.roadTop + this.roadBot) / 2 - 1, 22, 20); // broken centre line
    }
    // near kerb
    ctx.fillStyle = st.night ? '#3B4250' : '#C9CDD1';
    ctx.fillRect(0, this.roadBot, W, 4 * this.scale);
  }

  drawMarkers(st) {
    const { ctx } = this;
    // Street lamps / posts along the far roadside move with the road.
    const lampSpan = 210;
    const off = this.pos;
    if (this.env !== 'luarbandar') {
      for (let i = Math.floor(off / lampSpan) - 1; i < (off + this.W) / lampSpan + 1; i++) {
        const x = i * lampSpan - off + this.vx * 0.2;
        const img = this.sprite('lamp', st);
        const h = img.height / this.dpr;
        ctx.drawImage(img, x, this.roadTop - h + 2, img.width / this.dpr, h);
        if (st.night) { const g = ctx.createRadialGradient(x + 22 * this.scale, this.roadTop + 6, 2, x + 22 * this.scale, this.roadTop + 6, 46 * this.scale); g.addColorStop(0, 'rgba(255,220,140,0.35)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(x - 30, this.roadTop - 30, 110 * this.scale, 80 * this.scale); }
      }
    }
    if (this.checkpoint) this.drawSpriteAt('cp', this.checkpoint.x + 62 * this.scale, this.checkpoint.label);
    if (this.finish) this.drawSpriteAt(this.finish.kind === 'arrive' ? 'gate' : 'learn', this.finish.x + (this.finish.kind === 'arrive' ? -10 : 22));
  }

  drawSpriteAt(kind, worldX, label) {
    const { ctx } = this;
    const img = this.sprite(kind, ENV_STYLE[this.env]);
    const w = img.width / this.dpr, h = img.height / this.dpr;
    const x = this.sx(worldX, 1);
    ctx.drawImage(img, x, this.roadTop - h + (kind === 'gate' ? 18 * this.scale : 2), w, h);
    if (label && kind === 'cp') {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${Math.round(13 * this.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, x + 32 * this.scale, this.roadTop - h + 34 * this.scale);
      ctx.textAlign = 'start';
    }
  }

  drawOncoming(st) {
    for (const o of this.oncoming) {
      if (o.moto) drawMoto(this.ctx, o.sx, this.oncomingY, this.scale * 0.9, o.color, -1, this.pos * 0.08, st.night || st.rain);
      else drawCar(this.ctx, o.sx, this.oncomingY, this.scale * 0.92, o.color, -1, this.pos * 0.06, st.night || st.rain);
    }
  }

  drawPlayer(st) {
    const v = this.vehicle;
    const bob = this.speed > 5 ? Math.sin(this.pos * 0.08) * 0.6 : 0;
    const lights = st.night || st.rain;
    const wheelAngle = this.pos / (11 * this.scale);
    if (lights) {
      const g = this.ctx.createLinearGradient(this.vx + 40 * this.scale, 0, this.vx + 170 * this.scale, 0);
      g.addColorStop(0, 'rgba(255,240,190,0.45)'); g.addColorStop(1, 'rgba(255,240,190,0)');
      this.ctx.fillStyle = g;
      this.ctx.beginPath(); this.ctx.moveTo(this.vx + 40 * this.scale, this.laneY - 14 * this.scale); this.ctx.lineTo(this.vx + 170 * this.scale, this.laneY - 2 * this.scale); this.ctx.lineTo(this.vx + 170 * this.scale, this.laneY + 10 * this.scale); this.ctx.lineTo(this.vx + 40 * this.scale, this.laneY - 6 * this.scale); this.ctx.fill();
    }
    if (v.type === 'motorcycle') drawMoto(this.ctx, this.vx, this.laneY + bob, this.scale, v.color, 1, wheelAngle, lights, true);
    else drawCar(this.ctx, this.vx, this.laneY + bob, this.scale, v.color, 1, wheelAngle, lights, true);
  }

  drawForeground(st) {
    const { ctx, W, H } = this;
    ctx.fillStyle = st.ground; ctx.fillRect(0, this.roadBot + 4 * this.scale, W, H - this.roadBot);
    const span = 90; const off = this.pos * 1.15;
    ctx.fillStyle = st.night ? '#173326' : 'rgba(40,90,40,0.55)';
    for (let i = Math.floor(off / span) - 1; i < (off + W) / span + 1; i++) {
      if (hash(i + 300) < 0.45) continue;
      const x = i * span - off + hash(i) * 40;
      ctx.beginPath(); ctx.ellipse(x, H - 2, 22 * this.scale, 9 * this.scale, 0, Math.PI, 0); ctx.fill();
    }
  }

  drawRain() {
    const { ctx } = this;
    if (!this.rain.length) for (let i = 0; i < 50; i++) this.rain.push({ x: hash(i) * this.W, y: hash(i + 20) * this.H, l: 8 + hash(i + 40) * 8 });
    ctx.strokeStyle = 'rgba(220,232,245,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const r of this.rain) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 3, r.y + r.l); }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- sprites
function drawSprite(g, kind, [w, h], st) {
  const night = st.night;
  const win = night ? '#FFD887' : '#CFE3F5';
  if (kind.startsWith('house')) {
    const walls = ['#F3E3C3', '#E7EEF2', '#F6D7C3'];
    const v = Number(kind.slice(-1));
    g.fillStyle = night ? '#4A5466' : walls[v]; g.fillRect(4, 20, 56, 32);
    g.fillStyle = night ? '#3A2E36' : ['#B5523B', '#3E6E8E', '#7A4E3A'][v];
    g.beginPath(); g.moveTo(0, 22); g.lineTo(32, 4); g.lineTo(64, 22); g.closePath(); g.fill();
    g.fillStyle = night ? '#2B2B33' : '#8B5A3C'; g.fillRect(26, 34, 11, 18);
    g.fillStyle = win; g.fillRect(9, 28, 12, 10); g.fillRect(43, 28, 12, 10);
  } else if (kind.startsWith('shop')) {
    const hh = h;
    const cols = ['#E8D9B5', '#CFD8DC', '#F0C9A8'];
    g.fillStyle = night ? '#3C4658' : cols[Number(kind.slice(-1))]; g.fillRect(2, 4, 54, hh - 4);
    g.fillStyle = night ? '#2A3140' : '#F2F2F2'; g.fillRect(2, hh - 22, 54, 4);
    g.fillStyle = night ? '#55606F' : '#7F8C8D'; g.fillRect(2, hh - 18, 54, 18);
    g.fillStyle = win;
    for (let y = 10; y < hh - 28; y += 14) for (let x = 8; x < 50; x += 16) g.fillRect(x, y, 9, 8);
  } else if (kind === 'tree') {
    g.fillStyle = '#6B4A2B'; g.fillRect(19, 34, 6, 26);
    g.fillStyle = night ? '#1F4A33' : '#3E8E41';
    g.beginPath(); g.arc(22, 24, 18, 0, TAU); g.fill();
    g.fillStyle = night ? '#28573D' : '#56A85A'; g.beginPath(); g.arc(15, 20, 9, 0, TAU); g.fill();
  } else if (kind === 'palm') {
    g.fillStyle = '#7A5A3A'; g.fillRect(24, 26, 6, 40);
    g.strokeStyle = night ? '#24503A' : '#2F7D3B'; g.lineWidth = 4; g.lineCap = 'round';
    for (const [dx, dy] of [[-22, 6], [22, 6], [-16, -10], [16, -10], [0, -16], [-24, 18], [24, 18]]) { g.beginPath(); g.moveTo(27, 26); g.quadraticCurveTo(27 + dx * 0.5, 26 + dy - 8, 27 + dx, 26 + dy); g.stroke(); }
  } else if (kind === 'kampung') {
    g.fillStyle = night ? '#4A3B33' : '#A8794F'; g.fillRect(8, 22, 46, 18);
    g.fillStyle = '#6B4A2B'; for (const x of [10, 30, 50]) g.fillRect(x, 40, 3, 10);
    g.fillStyle = night ? '#3A2E36' : '#8C3B2E'; g.beginPath(); g.moveTo(2, 24); g.lineTo(31, 6); g.lineTo(60, 24); g.closePath(); g.fill();
    g.fillStyle = win; g.fillRect(16, 27, 9, 8); g.fillRect(38, 27, 9, 8);
  } else if (kind === 'lamp') {
    g.fillStyle = night ? '#9AA3AD' : '#7D8790'; g.fillRect(4, 10, 3, 64);
    g.fillRect(4, 10, 20, 3);
    g.fillStyle = night ? '#FFE6A6' : '#D9DEE3'; g.fillRect(18, 12, 9, 4);
  } else if (kind === 'cp') {
    g.fillStyle = '#5F6B76'; g.fillRect(30, 30, 4, 44);
    g.fillStyle = '#0C807C'; roundRect(g, 2, 4, 60, 30, 7); g.fill();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; roundRect(g, 5, 7, 54, 24, 5); g.stroke();
    g.fillStyle = '#F2A900'; g.beginPath(); g.moveTo(34, 36); g.lineTo(52, 42); g.lineTo(34, 48); g.fill();
  } else if (kind === 'gate') {
    g.fillStyle = '#0B2240'; g.fillRect(6, 10, 8, 86); g.fillRect(106, 10, 8, 86);
    g.fillStyle = '#0C807C'; roundRect(g, 0, 4, 120, 26, 8); g.fill();
    g.fillStyle = '#FFFFFF'; g.font = '800 13px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('DESTINASI: LESEN', 60, 22);
    g.fillStyle = '#F2A900'; for (let i = 0; i < 6; i++) g.fillRect(14 + i * 16, 32, 8, 6);
  } else if (kind === 'learn') {
    g.fillStyle = '#5F6B76'; g.fillRect(36, 34, 4, 40);
    g.fillStyle = '#F2A900'; roundRect(g, 2, 2, 72, 34, 8); g.fill();
    g.fillStyle = '#0B2240'; g.font = '800 10px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('TITIK', 38, 16); g.fillText('PEMBELAJARAN', 38, 29);
  }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function wheel(g, x, y, r, angle) {
  g.fillStyle = '#1C232B'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = '#C9D3DD'; g.beginPath(); g.arc(x, y, r * 0.55, 0, TAU); g.fill();
  g.strokeStyle = '#6D7883'; g.lineWidth = Math.max(1, r * 0.14);
  g.beginPath();
  for (let k = 0; k < 5; k++) { const a = angle + (k * TAU) / 5; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); }
  g.stroke();
  g.fillStyle = '#3E4852'; g.beginPath(); g.arc(x, y, r * 0.16, 0, TAU); g.fill();
}

/** Car in profile. (x, y) = centre bottom of the wheels; dir 1 faces right. */
export function drawCar(g, x, y, s, color, dir, angle, lights, player = false) {
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  const r = 10;
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(0, 1, 48, 4, 0, 0, TAU); g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-46, -r); g.lineTo(-47, -24); g.quadraticCurveTo(-46, -30, -38, -31); g.lineTo(-24, -32);
  g.quadraticCurveTo(-16, -46, 4, -46); g.lineTo(16, -46); g.quadraticCurveTo(26, -45, 33, -33);
  g.lineTo(44, -30); g.quadraticCurveTo(50, -28, 50, -20); g.lineTo(50, -r); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = 'rgba(207,227,245,0.95)';
  g.beginPath(); g.moveTo(-19, -32); g.quadraticCurveTo(-13, -43, 2, -43); g.lineTo(5, -43); g.lineTo(5, -32); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(9, -43); g.lineTo(15, -43); g.quadraticCurveTo(23, -42, 28, -32); g.lineTo(9, -32); g.closePath(); g.fill();
  if (player) { g.fillStyle = '#26323D'; g.beginPath(); g.arc(14, -36, 4, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(6, -31); g.lineTo(6, -13); g.stroke();
  g.fillStyle = lights ? '#FFF6C9' : '#FFF0B3'; g.fillRect(45, -27, 5, 5);
  g.fillStyle = '#E04B3B'; g.fillRect(-47, -27, 4, 6);
  g.fillStyle = '#26323D'; g.fillRect(-48, -14, 98, 3);
  wheel(g, -28, -r + 2, r, angle); wheel(g, 30, -r + 2, r, angle);
  g.restore();
}

/** Motorcycle with a helmeted rider in profile. */
export function drawMoto(g, x, y, s, color, dir, angle, lights, player = false) {
  g.save(); g.translate(x, y); g.scale(s * dir, s);
  const r = 11;
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(0, 1, 34, 3.5, 0, 0, TAU); g.fill();
  wheel(g, -24, -r, r, angle); wheel(g, 25, -r, r, angle);
  g.strokeStyle = '#2B3640'; g.lineWidth = 3.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(25, -r); g.lineTo(17, -38); g.stroke(); // fork
  g.beginPath(); g.moveTo(-24, -r); g.lineTo(-6, -18); g.stroke(); // swingarm
  g.fillStyle = color;
  g.beginPath(); g.moveTo(-26, -26); g.lineTo(-6, -28); g.lineTo(4, -34); g.lineTo(18, -34); g.lineTo(22, -26); g.lineTo(8, -16); g.lineTo(-14, -16); g.closePath(); g.fill();
  g.fillStyle = '#4A5560'; g.fillRect(-10, -20, 14, 9); // engine
  g.fillStyle = '#26323D'; g.fillRect(-24, -30, 18, 4); // seat
  g.fillStyle = lights ? '#FFF6C9' : '#FFF0B3'; g.beginPath(); g.arc(23, -32, 3, 0, TAU); g.fill();
  g.fillStyle = '#E04B3B'; g.fillRect(-29, -29, 4, 3);
  // rider: jacket, arm, helmet
  const jacket = player ? '#F2A900' : '#5C6B7A';
  g.strokeStyle = '#2E3A46'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(-12, -30); g.lineTo(-4, -18); g.lineTo(2, -14); g.stroke(); // leg
  g.fillStyle = jacket; g.beginPath(); g.moveTo(-18, -30); g.lineTo(-12, -54); g.lineTo(-2, -54); g.lineTo(-2, -30); g.closePath(); g.fill();
  g.strokeStyle = jacket; g.lineWidth = 4.5; g.beginPath(); g.moveTo(-6, -50); g.lineTo(13, -38); g.stroke(); // arm
  g.fillStyle = player ? '#FFFFFF' : '#D9DEE3'; g.beginPath(); g.arc(-7, -61, 8, 0, TAU); g.fill(); // helmet
  g.fillStyle = '#1C2A38'; g.fillRect(-3, -64, 8, 5); // visor
  g.restore();
}
