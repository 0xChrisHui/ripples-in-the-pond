import { GRAMMARS } from './data.js';

const CASES = {
  1:[[3,2]],2:[[2,1]],3:[[3,1]],4:[[0,1]],5:[[0,3],[2,1]],6:[[0,2]],7:[[0,3]],
  8:[[3,0]],9:[[0,2]],10:[[3,2],[0,1]],11:[[0,1]],12:[[3,1]],13:[[2,1]],14:[[3,2]]
};

export class TerrainField {
  constructor(canvas, getState) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha:true });
    this.getState = getState;
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.lastFrame = 0;
    this.palette = {};
    this.theme = '';
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    requestAnimationFrame((time) => this.frame(time));
  }

  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    this.width = Math.max(1, box.width);
    this.height = Math.max(1, box.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  readPalette() {
    const theme = document.documentElement.dataset.theme;
    if (theme === this.theme) return;
    const css = getComputedStyle(document.documentElement);
    this.palette.ink = css.getPropertyValue('--ink').trim();
    this.palette.accent = css.getPropertyValue('--accent').trim();
    this.theme = theme;
  }

  frame(timeMs) {
    const reduced = this.getState().reducedMotion;
    const interval = reduced ? 180 : 33;
    if (timeMs - this.lastFrame >= interval) {
      this.lastFrame = timeMs;
      this.render(timeMs / 1000, reduced);
    }
    requestAnimationFrame((time) => this.frame(time));
  }

  render(time, reduced = false) {
    this.readPalette();
    const state = this.getState();
    const columns = 48 + Number(state.tuning.density) * 4;
    const rows = Math.max(32, Math.round(columns * this.height / this.width));
    const values = new Float32Array((columns + 1) * (rows + 1));
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        values[row * (columns + 1) + column] = this.sample(column / columns, row / rows, reduced ? 0 : time, state);
      }
    }
    this.context.clearRect(0, 0, this.width, this.height);
    const spacing = 0.032;
    for (let index = 1; index <= state.tuning.density; index += 1) {
      this.drawContour(values, columns, rows, spacing * index, Number(state.tuning.ink));
    }
    this.drawHoverGuide(state);
    state.events.forEach((event) => this.drawEvent(event, reduced ? event.created + .16 : time, state.tuning));
  }

  sample(x, y, time, state) {
    const unit = Math.min(this.width, this.height);
    const warp = Number(state.tuning.warp);
    const wx = x + Math.sin(y * 9 + time * 0.18) * warp * 0.012;
    const wy = y + Math.cos(x * 8 - time * 0.13) * warp * 0.012;
    let nearest = 9;
    for (const track of state.tracks) {
      const dx = (wx - track.x) * this.width / unit;
      const dy = (wy - track.y) * this.height / unit;
      nearest = Math.min(nearest, Math.hypot(dx, dy));
    }
    let value = nearest + Math.sin(wx * 17 + wy * 11 + time * 0.08) * warp * 0.007;
    for (const event of state.events) {
      const age = time - event.created;
      if (age < 0 || age > Number(state.tuning.decay)) continue;
      const dx = (x - event.x) * this.width / unit;
      const dy = (y - event.y) * this.height / unit;
      const distance = Math.hypot(dx, dy);
      const radius = age * Number(state.tuning.speed);
      const envelope = Math.exp(-age * 0.52) * Math.exp(-Math.abs(distance - radius) * 22);
      value += Math.sin((distance - radius) * (25 + event.key)) * envelope * 0.035;
    }
    return value;
  }

  drawContour(values, columns, rows, level, alpha) {
    const context = this.context;
    const stride = columns + 1;
    context.beginPath();
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = values[row * stride + column];
        const b = values[row * stride + column + 1];
        const c = values[(row + 1) * stride + column + 1];
        const d = values[(row + 1) * stride + column];
        const mask = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        const pairs = CASES[mask];
        if (!pairs) continue;
        const edges = [
          this.edgePoint(column, row, 0, b, a, level, columns, rows),
          this.edgePoint(column, row, 1, b, c, level, columns, rows),
          this.edgePoint(column, row, 2, d, c, level, columns, rows),
          this.edgePoint(column, row, 3, a, d, level, columns, rows)
        ];
        pairs.forEach(([from, to]) => {
          context.moveTo(edges[from][0], edges[from][1]);
          context.lineTo(edges[to][0], edges[to][1]);
        });
      }
    }
    context.setLineDash([]);
    context.lineWidth = 0.75;
    context.globalAlpha = alpha;
    context.strokeStyle = this.palette.ink;
    context.stroke();
    context.globalAlpha = 1;
  }

  edgePoint(column, row, edge, start, end, level, columns, rows) {
    const amount = Math.abs(end - start) < 0.00001 ? 0.5 : (level - start) / (end - start);
    const points = [
      [column + amount, row], [column + 1, row + amount],
      [column + amount, row + 1], [column, row + amount]
    ];
    return [points[edge][0] / columns * this.width, points[edge][1] / rows * this.height];
  }

  drawHoverGuide(state) {
    const track = state.tracks.find((item) => item.id === state.hoveredId);
    if (!track) return;
    const x = track.x * this.width;
    const y = track.y * this.height;
    this.context.beginPath();
    this.context.moveTo(x, y);
    this.context.lineTo(this.width, y);
    this.context.setLineDash([2, 5]);
    this.context.strokeStyle = this.palette.accent;
    this.context.globalAlpha = 0.55;
    this.context.stroke();
    this.context.globalAlpha = 1;
    this.context.setLineDash([]);
  }

  drawEvent(event, time, tuning) {
    const age = time - event.created;
    if (age < 0 || age > Number(tuning.decay)) return;
    const grammar = GRAMMARS[event.key % GRAMMARS.length];
    const radius = age * Number(tuning.speed) * Math.min(this.width, this.height);
    const fade = Math.max(0, 1 - age / Number(tuning.decay));
    const context = this.context;
    context.save();
    context.translate(event.x * this.width, event.y * this.height);
    context.rotate(grammar.rotation + age * 0.08 * grammar.direction);
    context.strokeStyle = this.palette.accent;
    context.fillStyle = this.palette.accent;
    context.lineWidth = 1.2;
    context.globalAlpha = fade * 0.72;
    context.setLineDash(grammar.dash ? [grammar.dash, grammar.dash * 0.7] : []);
    this.drawGrammar(grammar, Math.max(4, radius));
    context.restore();
  }

  drawGrammar(grammar, radius) {
    const c = this.context;
    const ring = (scale=1, start=0, end=Math.PI * 2) => { c.beginPath(); c.arc(0, 0, radius * scale, start, end); c.stroke(); };
    const polygon = (sides, scale=1) => { c.beginPath(); for (let i=0;i<=sides;i+=1){ const a=i/sides*Math.PI*2; const x=Math.cos(a)*radius*scale; const y=Math.sin(a)*radius*scale; if (i) c.lineTo(x,y); else c.moveTo(x,y); } c.stroke(); };
    switch (grammar.type) {
      case 0: for(let i=0;i<grammar.echoes;i+=1) ring(1-i*.14); break;
      case 1: polygon(grammar.sides); break;
      case 2: ring(); for(let i=0;i<grammar.sides;i+=1){const a=i/grammar.sides*Math.PI*2;c.beginPath();c.moveTo(Math.cos(a)*radius*.3,Math.sin(a)*radius*.3);c.lineTo(Math.cos(a)*radius*1.25,Math.sin(a)*radius*1.25);c.stroke();} break;
      case 3: c.beginPath();c.moveTo(-radius,0);c.lineTo(radius,0);c.moveTo(0,-radius);c.lineTo(0,radius);c.stroke(); break;
      case 4: c.beginPath();for(let i=0;i<50;i+=1){const a=i*.28;const r=radius*i/50;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.stroke(); break;
      case 5: for(let i=-2;i<=2;i+=1){c.beginPath();c.moveTo(-radius,i*7);c.lineTo(radius,i*7);c.stroke();} break;
      case 6: for(let i=-2;i<=2;i+=1){c.beginPath();c.moveTo(i*8,-radius);c.lineTo(i*8,radius);c.stroke();} break;
      case 7: for(let i=0;i<grammar.echoes+1;i+=1) ring(1-i*.16,-1.1,1.1); break;
      case 8: polygon(4); polygon(4,.55); break;
      case 9: ring(.75,-Math.PI*.8,Math.PI*.2);ring(1.05,Math.PI*.2,Math.PI*1.2); break;
      case 10: c.beginPath();c.moveTo(-radius,0);c.bezierCurveTo(-radius,-radius,radius,radius,radius,0);c.bezierCurveTo(radius,-radius,-radius,radius,-radius,0);c.stroke(); break;
      case 11: for(let i=0;i<grammar.echoes+1;i+=1){c.beginPath();c.arc(i*5,-i*3,radius*(1-i*.12),0,Math.PI*2);c.stroke();} break;
      default: c.beginPath();c.moveTo(0,0);c.arc(0,0,radius,-.65,.65);c.closePath();c.stroke();
    }
  }
}
