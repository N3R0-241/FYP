import { clamp, cssRgb, hexToRgb, mixRgb, norm, orient, projectPoint, rotateSwing, sampleHoop, shadeMetal } from "./geom.js";

export function drawEarring(p, product, ear, pose, swing, image) {
  if (!ear || ear.visibility < 0.05) return;
  const dims = {
    radius: clamp(Number(product.radiusMm) || 4, 1, 36),
    tube: clamp(Number(product.tubeMm) || 1, 0.3, 4),
    drop: clamp(Number(product.dropMm) || 0, 0, 80),
  };
  const ctx = p.drawingContext;
  ctx.save();
  ctx.globalAlpha = ear.visibility;
  const placement = { product, ear, pose, swing, image, dims, px: ear.pxPerMm };
  if (product.style === "hoop") drawHoop(p, placement);
  else if (product.style === "cuff") drawCuff(p, placement);
  else if (product.style === "chandelier") drawChandelier(p, placement);
  else if (product.style === "drop") drawDrop(p, placement);
  else drawStud(p, placement);
  ctx.restore();
}

function drawStud(p, placement) {
  const { ear, pose, dims, product, image, cap } = placement;
  const anchor = ear.lobe;
  if (cap) {
    const radius = Math.max(2, 1.35 * ear.pxPerMm);
    const rgb = shadeMetal(product.metal, { x: -0.1, y: -0.3, z: 1 });
    drawSphere(p, anchor.x, anchor.y, radius, rgb, { x: -0.2, y: -0.3, z: 1 });
    return;
  }
  if (product.shape === "bar") {
    drawBar(p, placement, anchor);
    return;
  }
  const normal = norm(orient({ x: -0.15, y: -0.35, z: 1 }, pose, ear.outward, "rigid"));
  const rgb = shadeMetal(product.metal, normal);
  const radius = Math.max(2.5, dims.radius * ear.pxPerMm);
  drawSphere(p, anchor.x - normal.x * radius * 0.15, anchor.y - normal.y * radius * 0.15, radius, rgb, normal);
  if (image) {
    drawBillboard(p, image, anchor.x, anchor.y - radius * 0.1, radius * 2.4, radius * 2.4, faceOpen(pose, ear.outward));
  } else if (product.metal !== "pearl") {
    drawGem(p, anchor.x, anchor.y, radius * 0.62, product.gem, faceOpen(pose, ear.outward));
  }
}

function drawBar(p, placement, anchor) {
  const { ear, pose, dims, product } = placement;
  const half = dims.drop / 2 || 4;
  const a = projectPoint(orient({ x: -half, y: 0, z: 0 }, pose, ear.outward, "bar"), anchor, ear.pxPerMm);
  const b = projectPoint(orient({ x: half, y: 0, z: 0 }, pose, ear.outward, "bar"), anchor, ear.pxPerMm);
  const rgb = shadeMetal(product.metal, orient({ x: 0, y: -0.2, z: 1 }, pose, ear.outward, "bar"));
  strokeLine(p, a, b, rgb, Math.max(2, dims.tube * ear.pxPerMm * 2.2));
  drawGem(p, (a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(3, dims.radius * ear.pxPerMm), product.gem, faceOpen(pose, ear.outward));
}

function drawHoop(p, placement) {
  const { ear, pose, dims, product, image } = placement;
  const segments = collectHoop(ear, pose, dims.radius, product.metal);
  paintSegments(p, segments, dims.tube * ear.pxPerMm);
  const cap = Math.max(2, 1.3 * ear.pxPerMm);
  const rgb = shadeMetal(product.metal, { x: 0, y: -0.2, z: 1 });
  drawSphere(p, ear.lobe.x, ear.lobe.y, cap, rgb, { x: -0.2, y: -0.3, z: 1 });
  if (image) {
    const bottom = sampleHoop(0, dims.radius, pose, ear.outward, ear.pxPerMm);
    drawBillboard(
      p,
      image,
      ear.lobe.x + bottom.x,
      ear.lobe.y + bottom.y,
      dims.radius * ear.pxPerMm,
      dims.radius * ear.pxPerMm,
      faceOpen(pose, ear.outward),
    );
  }
}

function collectHoop(ear, pose, radius, metal) {
  const gap = 0.42;
  const count = 52;
  const span = Math.PI * 2 - gap * 2;
  const segments = [];
  for (let i = 0; i < count; i += 1) {
    const t0 = Math.PI + gap + span * (i / count);
    const t1 = Math.PI + gap + span * ((i + 1) / count);
    const a = sampleHoop(t0, radius, pose, ear.outward, ear.pxPerMm);
    const b = sampleHoop(t1, radius, pose, ear.outward, ear.pxPerMm);
    const mid = (t0 + t1) / 2;
    const radial = orient(
      { x: 0, y: Math.cos(mid), z: Math.sin(mid) },
      pose,
      ear.outward,
      "hoop",
    );
    segments.push({
      a: { x: ear.lobe.x + a.x, y: ear.lobe.y + a.y, z: a.z },
      b: { x: ear.lobe.x + b.x, y: ear.lobe.y + b.y, z: b.z },
      z: (a.z + b.z) / 2,
      color: shadeMetal(metal, radial),
      persp: (a.persp + b.persp) / 2,
    });
  }
  segments.sort((left, right) => left.z - right.z);
  return segments;
}

function drawDrop(p, placement) {
  const { ear, pose, dims, product, swing, image } = placement;
  drawStud(p, { ...placement, image: null, cap: true });
  const end = drawChain(p, placement, ear.lobe, dims.drop, 0, swing);
  if (image) {
    const size = Math.max(16, dims.radius * 2.4 * ear.pxPerMm);
    drawBillboard(p, image, end.x, end.y + size * 0.35, size, size, faceOpen(pose, ear.outward));
    return;
  }
  const radius = Math.max(3, dims.radius * ear.pxPerMm * end.persp);
  if (product.shape === "pearl" || product.metal === "pearl" || product.material === "pearl") {
    drawSphere(p, end.x, end.y, radius, shadeMetal("pearl", { x: -0.15, y: -0.4, z: 1 }), { x: -0.2, y: -0.35, z: 1 });
  } else {
    drawGem(p, end.x, end.y, radius, product.gem, faceOpen(pose, ear.outward));
  }
}

function drawChandelier(p, placement) {
  const { ear, pose, dims, product, swing } = placement;
  drawStud(p, { ...placement, image: null, cap: true });
  const strands = [
    { x: -3.3, length: dims.drop * 0.62, phase: -0.12 },
    { x: 0, length: dims.drop * 0.84, phase: 0.04 },
    { x: 3.3, length: dims.drop, phase: 0.14 },
  ];
  for (const strand of strands) {
    const end = drawChain(p, placement, ear.lobe, strand.length, strand.x, swing + strand.phase);
    drawGem(p, end.x, end.y, Math.max(3, dims.radius * ear.pxPerMm), product.gem, faceOpen(pose, ear.outward));
  }
}

function drawChain(p, placement, anchor, lengthMm, sideMm, swing) {
  const { ear, pose, product, dims } = placement;
  const count = Math.max(3, Math.round(lengthMm / 3.2));
  let previous = null;
  let last = { x: anchor.x, y: anchor.y, persp: 1 };
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const local = rotateSwing(
      { x: sideMm + ear.outward * 0.8, y: 1.4 + lengthMm * t, z: 0 },
      swing * (0.3 + 0.7 * t),
    );
    const world = orient(local, pose, ear.outward, "front");
    const point = projectPoint(world, anchor, ear.pxPerMm);
    if (previous) {
      const color = shadeMetal(product.metal, orient({ x: 0.1, y: -0.2, z: 1 }, pose, ear.outward, "front"));
      strokeLine(p, previous, point, color, Math.max(1.2, dims.tube * ear.pxPerMm * point.persp));
    }
    previous = point;
    last = point;
  }
  return last;
}

function drawCuff(p, placement) {
  const { ear, pose, dims, product } = placement;
  const count = 28;
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const angle = Math.PI * (0.2 + t * 1.05);
    const local = {
      x: ear.outward * (dims.radius * 0.16 * Math.sin(angle)),
      y: -dims.radius * (0.02 + 0.38 * Math.sin(angle)),
      z: dims.radius * 0.18 * Math.cos(angle),
    };
    const world = orient(local, pose, ear.outward, "rigid");
    points.push(projectPoint(world, ear.helix, ear.pxPerMm));
  }
  for (let i = 1; i < points.length; i += 1) {
    const color = shadeMetal(product.metal, { x: ear.outward * 0.2, y: -0.35, z: 0.9 });
    strokeLine(p, points[i - 1], points[i], color, Math.max(1.6, dims.tube * ear.pxPerMm * points[i].persp * 1.7));
  }
  for (const index of [4, 14, 24]) {
    const point = points[index];
    if (!point) continue;
    drawGem(p, point.x, point.y, Math.max(2.5, 1.7 * ear.pxPerMm), product.gem, faceOpen(pose, ear.outward));
  }
}

function paintSegments(p, segments, tubePx) {
  for (const segment of segments) {
    strokeLine(p, segment.a, segment.b, segment.color, Math.max(1.4, tubePx * segment.persp * 2));
  }
}

function strokeLine(p, a, b, rgb, weight) {
  p.stroke(rgb[0], rgb[1], rgb[2]);
  p.strokeWeight(weight);
  p.strokeCap(p.ROUND);
  p.line(a.x, a.y, b.x, b.y);
}

function drawSphere(p, x, y, radius, rgb, normal) {
  const ctx = p.drawingContext;
  const hx = x - normal.x * radius * 0.35;
  const hy = y + normal.y * radius * 0.35;
  const highlight = mixRgb(rgb, [255, 252, 246], 0.72);
  const shadow = rgb.map((channel) => Math.round(channel * 0.42));
  const gradient = ctx.createRadialGradient(hx, hy, radius * 0.08, x, y, radius);
  gradient.addColorStop(0, cssRgb(highlight));
  gradient.addColorStop(0.42, cssRgb(rgb));
  gradient.addColorStop(1, cssRgb(shadow));
  ctx.beginPath();
  ctx.fillStyle = gradient;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawGem(p, x, y, radius, hex, open) {
  const [r, g, b] = hexToRgb(hex);
  const rx = Math.max(1.5, radius * clamp(open, 0.35, 1));
  p.push();
  p.noStroke();
  p.fill(r, g, b);
  p.quad(x, y - radius, x + rx, y, x, y + radius, x - rx, y);
  p.fill(255, 255, 255, 170);
  p.triangle(x, y - radius * 0.78, x + rx * 0.32, y - radius * 0.05, x - rx * 0.08, y - radius * 0.12);
  p.pop();
}

function drawBillboard(p, image, x, y, width, height, open) {
  const drawWidth = width * clamp(open, 0.28, 1);
  p.drawingContext.save();
  p.drawingContext.drawImage(image, x - drawWidth / 2, y, drawWidth, height);
  p.drawingContext.restore();
}

function faceOpen(pose, outward) {
  return Math.abs(Math.cos(-outward * (pose.yaw || 0)));
}

export function drawMannequin(p, view, yaw, pitch) {
  const earScale = Math.min(view.w, view.h) * 0.2;
  const headRx = earScale * 1.22;
  const headRy = earScale * 1.62 * (1 - pitch * 0.08);
  const cx = view.x + view.w / 2 + yaw * earScale * 0.28;
  const cy = view.y + view.h * 0.46 + pitch * earScale * 0.25;
  const skin = [214, 176, 156];
  const skinDeep = [186, 142, 124];
  const ink = [92, 64, 54];
  const hair = [42, 33, 29];

  p.noStroke();
  p.fill(hair[0], hair[1], hair[2]);
  p.rect(cx - headRx * 0.92, cy - headRy * 1.22, headRx * 1.84, headRy * 0.95, 18);
  p.ellipse(cx, cy - headRy * 0.72, headRx * 2.15, headRy * 1.15);

  p.fill(skinDeep[0], skinDeep[1], skinDeep[2]);
  p.rect(cx - headRx * 0.34, cy + headRy * 0.78, headRx * 0.68, earScale * 0.85, 12);

  p.fill(skin[0], skin[1], skin[2]);
  p.ellipse(cx, cy, headRx * 2, headRy * 2);

  const lobeY = cy + earScale * 0.18;
  // The head faces the camera, so the wearer's right ear is on the viewer's left.
  const left = mannequinEar(cx - headRx - earScale * 0.02 + yaw * earScale * 0.22, lobeY, earScale, -1, "right");
  const right = mannequinEar(cx + headRx + earScale * 0.02 + yaw * earScale * 0.22, lobeY, earScale, 1, "left");
  drawEarShape(p, left, skin, skinDeep, ink);
  drawEarShape(p, right, skin, skinDeep, ink);

  p.stroke(ink[0], ink[1], ink[2], 90);
  p.strokeWeight(1);
  p.noFill();
  p.arc(cx, cy + headRy * 0.18, headRx * 0.7, headRy * 0.45, 0.15, Math.PI - 0.15);

  return {
    head: { x: cx, y: cy, rx: headRx * 0.9, ry: headRy * 0.92, fill: skin },
    ears: { left, right },
    pxPerMm: (earScale * 1.15) / 60,
  };
}

function mannequinEar(x, y, scale, outward, body) {
  return {
    body,
    outward,
    lobe: { x, y },
    helix: { x: x + outward * scale * 0.08, y: y - scale * 0.92 },
    superior: { x: x + outward * scale * 0.22, y: y - scale * 1.12 },
    tragus: { x: x - outward * scale * 0.02, y: y - scale * 0.38 },
    visibility: 1,
    pxPerMm: 1,
  };
}

function drawEarShape(p, ear, skin, deep, ink) {
  const scale = Math.abs(ear.helix.y - ear.lobe.y) / 0.92;
  p.push();
  p.translate(ear.lobe.x, ear.lobe.y);
  p.scale(ear.outward, 1);
  p.noStroke();
  p.fill(skin[0], skin[1], skin[2]);
  p.beginShape();
  p.vertex(0, 2);
  p.bezierVertex(scale * 0.42, -scale * 0.05, scale * 0.58, -scale * 0.48, scale * 0.4, -scale * 0.86);
  p.bezierVertex(scale * 0.28, -scale * 1.18, scale * 0.02, -scale * 1.22, -scale * 0.08, -scale * 0.98);
  p.bezierVertex(-scale * 0.18, -scale * 0.72, -scale * 0.12, -scale * 0.28, -scale * 0.02, 4);
  p.endShape(p.CLOSE);
  p.fill(deep[0], deep[1], deep[2]);
  p.ellipse(scale * 0.12, -scale * 0.52, scale * 0.28, scale * 0.42);
  p.fill(skin[0], skin[1], skin[2]);
  p.ellipse(scale * 0.02, 2, scale * 0.3, scale * 0.26);
  p.noFill();
  p.stroke(ink[0], ink[1], ink[2], 120);
  p.strokeWeight(1.2);
  p.arc(scale * 0.18, -scale * 0.5, scale * 0.22, scale * 0.34, -0.4, 2.4);
  p.pop();
}

export function refillHead(p, head) {
  p.noStroke();
  p.fill(head.fill[0], head.fill[1], head.fill[2]);
  p.ellipse(head.x, head.y, head.rx * 2, head.ry * 2);
}

export function clipRedraw(p, media, view, mirror, polygon, drawMedia) {
  if (!polygon || polygon.length < 8) return;
  const ctx = p.drawingContext;
  ctx.save();
  ctx.beginPath();
  polygon.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.clip();
  drawMedia(media, view, mirror);
  ctx.restore();
}
