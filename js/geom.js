// Millimetre earring geometry, projected into the canvas.
// +x is screen right, +y is screen down, +z points toward the camera.
// Hoops live in the plane of the ear. Drops and chandeliers face the camera and hang down.

export const IPD_MM = 63;
const HOOP_FLARE = 0.52;

export const METALS = {
  gold: { dark: [92, 64, 28], base: [206, 160, 84], light: [255, 232, 186], spec: [255, 250, 240] },
  silver: { dark: [78, 84, 92], base: [186, 194, 204], light: [246, 248, 252], spec: [255, 255, 255] },
  rose: { dark: [112, 64, 60], base: [206, 140, 128], light: [255, 214, 204], spec: [255, 244, 240] },
  pearl: { dark: [168, 150, 140], base: [242, 232, 222], light: [255, 250, 246], spec: [255, 255, 255] },
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function norm(v) {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function rotateYaw(v, yaw) {
  // Positive yaw moves +z toward +x, which is the nose moving to screen right.
  const x = v.x;
  const y = -v.y;
  const z = v.z;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: c * x + s * z, y: -y, z: -s * x + c * z };
}

export function rotatePitch(v, pitch) {
  const x = v.x;
  const y = -v.y;
  const z = v.z;
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  const y2 = c * y - s * z;
  return { x, y: -(y2), z: s * y + c * z };
}

export function rotateRoll(v, roll) {
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  return { x: c * v.x - s * v.y, y: s * v.x + c * v.y, z: v.z };
}

export function rotateSwing(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c * v.x - s * v.y, y: s * v.x + c * v.y, z: v.z };
}

export function orient(v, pose, outward, mode) {
  const yaw = pose.yaw || 0;
  const pitch = pose.pitch || 0;
  const roll = pose.roll || 0;
  if (mode === "front" || mode === "bar") {
    let point = rotateYaw(v, -outward * yaw);
    point = rotatePitch(point, mode === "bar" ? pitch : pitch * 0.25);
    if (mode === "bar") point = rotateRoll(point, roll);
    return point;
  }
  // Sagittal pieces (hoops and cuffs). The screen-left ear opens when yaw is positive.
  let point = rotateYaw(v, outward * HOOP_FLARE - yaw);
  if (mode === "rigid") {
    point = rotatePitch(point, pitch);
    point = rotateRoll(point, roll);
  } else {
    point = rotatePitch(point, pitch * 0.35);
  }
  return point;
}

export function projectPoint(v, anchor, pxPerMm) {
  const depth = 90;
  const persp = depth / Math.max(28, depth - v.z);
  return {
    x: anchor.x + v.x * pxPerMm * persp,
    y: anchor.y + v.y * pxPerMm * persp,
    z: v.z,
    persp,
  };
}

export function sampleHoop(theta, radiusMm, pose, outward, pxPerMm = 1) {
  const local = {
    x: 0,
    y: radiusMm + radiusMm * Math.cos(theta),
    z: radiusMm * Math.sin(theta),
  };
  return projectPoint(orient(local, pose, outward, "hoop"), { x: 0, y: 0 }, pxPerMm);
}

export function hoopWidth(yaw, outward, radiusMm = 14) {
  let minX = Infinity;
  let maxX = -Infinity;
  const pose = { yaw, pitch: 0, roll: 0 };
  for (let i = 0; i <= 48; i += 1) {
    const theta = (i / 48) * Math.PI * 2;
    const point = sampleHoop(theta, radiusMm, pose, outward, 1);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
  }
  return maxX - minX;
}

export function shadeMetal(metalName, normal) {
  const metal = METALS[metalName] || METALS.gold;
  const n = norm(normal);
  const lights = [
    { dir: norm({ x: -0.28, y: -0.72, z: 0.64 }), w: 1 },
    { dir: norm({ x: 0.62, y: -0.12, z: 0.42 }), w: 0.38 },
  ];
  const view = { x: 0, y: 0, z: 1 };
  let diffuse = 0;
  let spec = 0;
  const shininess = metalName === "pearl" ? 10 : 36;
  for (const light of lights) {
    diffuse += light.w * clamp(dot(n, light.dir), 0, 1);
    const half = norm({
      x: light.dir.x + view.x,
      y: light.dir.y + view.y,
      z: light.dir.z + view.z,
    });
    spec += light.w * Math.pow(clamp(dot(n, half), 0, 1), shininess);
  }
  diffuse = clamp(diffuse / 1.38, 0, 1);
  const wrap = 0.22 + 0.78 * diffuse;
  return [0, 1, 2].map((channel) => {
    const body = metal.dark[channel] + (metal.base[channel] - metal.dark[channel]) * wrap;
    const lit = body + (metal.light[channel] - body) * diffuse * 0.55;
    return Math.round(clamp(lit + (metal.spec[channel] - lit) * clamp(spec, 0, 1) * 0.85, 0, 255));
  });
}

export function hexToRgb(hex) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex || "");
  if (!match) return [220, 225, 235];
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function cssRgb(rgb, alpha = 1) {
  if (alpha >= 1) return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
