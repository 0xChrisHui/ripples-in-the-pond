export class PondRenderer {
  constructor(pond) {
    this.pond = pond;
  }

  draw(time, delta) {
    const pond = this.pond;
    const context = pond.context;
    context.fillStyle = pond.background;
    context.fillRect(0, 0, pond.width, pond.height);
    this.drawMoon(time);
    this.drawWater(time);
    pond.waves.forEach((wave) => {
      wave.age += delta * pond.settings.waveSpeed;
      this.drawWave(wave);
    });
    pond.waves = pond.waves.filter((wave) => wave.age < 3.8 * pond.settings.damping);
    pond.tracks.forEach((track) => this.drawLifeform(track, time));
  }

  drawMoon(time) {
    const { context, width, height, settings } = this.pond;
    const x = width * .77;
    const y = height * .1;
    const glow = context.createRadialGradient(x, y, 0, x, y, width * .2);
    glow.addColorStop(0, `rgba(211,216,199,${.09 * settings.moon})`);
    glow.addColorStop(1, "rgba(211,216,199,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height * .6);
    context.save();
    context.globalAlpha = .08 * settings.moon;
    context.strokeStyle = "#d8d8c4";
    for (let i = 0; i < 12; i += 1) {
      const yy = height * (.17 + i * .026);
      const half = (22 + i * 7) * settings.moon;
      context.beginPath();
      context.moveTo(x - half + Math.sin(time + i) * 5, yy);
      context.lineTo(x + half + Math.cos(time * .7 + i) * 7, yy);
      context.stroke();
    }
    context.restore();
  }

  drawWater(time) {
    const { context, width, height, settings } = this.pond;
    context.save();
    context.globalAlpha = .045 + settings.drift * .018;
    context.strokeStyle = "#a7bbb0";
    context.lineWidth = .6;
    for (let line = 0; line < 15; line += 1) {
      const y = height * (.12 + line * .061);
      context.beginPath();
      for (let x = -20; x <= width + 20; x += 20) {
        const sway = Math.sin(x * .009 + time * .35 + line * .8) * (2 + settings.drift * 2);
        if (x === -20) context.moveTo(x, y + sway);
        else context.lineTo(x, y + sway);
      }
      context.stroke();
    }
    context.restore();
  }

  drawWave(wave) {
    const { context, settings } = this.pond;
    const life = Math.max(0, 1 - wave.age / (3.8 * settings.damping));
    const radius = 12 + wave.age * (55 + wave.strength * 26);
    const rings = wave.type === "double" || wave.type === "twin" ? 2 : 1;
    context.save();
    context.strokeStyle = wave.type === "focus" ? "#c4a56d" : "#d2d8c9";
    context.globalAlpha = life * .27 * wave.strength;
    context.lineWidth = wave.type === "wide" ? 2.2 : .8;
    for (let ring = 0; ring < rings; ring += 1) {
      context.beginPath();
      context.ellipse(
        wave.x,
        wave.y,
        radius + ring * 14,
        (radius + ring * 14) * .34,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    if (wave.type === "spiral" || wave.type === "arc") {
      context.beginPath();
      context.ellipse(wave.x, wave.y, radius * .7, radius * .23, wave.age, 0, Math.PI * 1.45);
      context.stroke();
    }
    context.restore();
  }

  drawLifeform(track, time) {
    const { context, activeId, hoverId, reduced, settings } = this.pond;
    const point = this.pond.positionFor(track, time);
    const selected = track.id === activeId;
    const hovered = track.id === hoverId;
    const dimmed = activeId && !selected;
    const breath = reduced ? 1 : 1 + Math.sin(time * .38 + track.phase) * .025;
    const radius = track.radius * breath * (selected ? 1.55 : hovered ? 1.12 : 1);
    const alpha = dimmed ? .15 * settings.contrast : hovered || selected ? 1 : .72;
    const gradient = context.createRadialGradient(
      point.x - radius * .32,
      point.y - radius * .42,
      1,
      point.x,
      point.y,
      radius * 1.2,
    );
    gradient.addColorStop(0, "rgba(241,238,216,.88)");
    gradient.addColorStop(.28, track.color);
    gradient.addColorStop(1, "rgba(12,25,23,.2)");
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = gradient;
    context.shadowColor = selected ? "#c4a56d" : track.color;
    context.shadowBlur = (selected ? 31 : hovered ? 18 : 9) * settings.glow;
    context.beginPath();
    for (let i = 0; i <= 24; i += 1) {
      const angle = i / 24 * Math.PI * 2;
      const edge = 1 + Math.sin(angle * track.membrane + track.phase) * .035;
      const x = point.x + Math.cos(angle) * radius * edge;
      const y = point.y + Math.sin(angle) * radius * edge * .92;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = selected ? "rgba(224,205,159,.7)" : "rgba(226,231,213,.25)";
    context.lineWidth = selected ? 1 : .55;
    context.stroke();
    if (selected || hovered) this.drawFocus(point, radius, selected);
    context.restore();
  }

  drawFocus(point, radius, selected) {
    const context = this.pond.context;
    context.globalAlpha = selected ? .42 : .2;
    context.strokeStyle = selected ? "#c4a56d" : "#dfe4d7";
    context.beginPath();
    context.ellipse(point.x, point.y, radius + 10, (radius + 10) * .38, 0, 0, Math.PI * 2);
    context.stroke();
  }
}
