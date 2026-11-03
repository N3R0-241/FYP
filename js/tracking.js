import { IPD_MM, clamp } from "./geom.js";

// MediaPipe Face Landmarker indices. The mesh is dense on the eyes, nose, and mouth,
// and only reaches the ear at the face oval. These points are the tragion approximation
// used as the seed for the three ear anchors in the report: superior auricular, tragus, lobule.
export const LANDMARKS = {
  nose: 1,
  forehead: 10,
  chin: 152,
  rightEye: 33,
  leftEye: 263,
  right: { tragus: 234, temple: 127, jaw: 132 },
  left: { tragus: 454, temple: 356, jaw: 361 },
};

export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

export function visibilityFromYaw(yaw, outward) {
  const noseShift = yaw / 0.95;
  const facing = -outward * noseShift;
  if (facing >= 0) return 1;
  const away = Math.min(1, -facing);
  if (away < 0.28) return 1;
  if (away > 0.82) return 0;
  return 1 - (away - 0.28) / 0.54;
}

export function depthVisibility(z, otherZ) {
  const farther = (z ?? 0) - (otherZ ?? 0);
  if (farther > 0.035) return 0.25;
  if (farther > 0.018) return 0.65;
  return 1;
}

export function analyzeFace(landmarks, view, mirror = false) {
  if (!landmarks || !view) return null;
  const nose = toScreen(landmarks, LANDMARKS.nose, view, mirror);
  const chin = toScreen(landmarks, LANDMARKS.chin, view, mirror);
  const rightEye = toScreen(landmarks, LANDMARKS.rightEye, view, mirror);
  const leftEye = toScreen(landmarks, LANDMARKS.leftEye, view, mirror);
  if (!nose || !chin || !rightEye || !leftEye) return null;

  const iod = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  if (iod < 8) return null;

  const midX = (rightEye.x + leftEye.x) / 2;
  const half = iod / 2;
  const noseShift = clamp((nose.x - midX) / half, -1.35, 1.35);
  const yaw = noseShift * 0.95;
  const eyeY = (rightEye.y + leftEye.y) / 2;
  const pitch = clamp(((nose.y - eyeY) / (chin.y - eyeY || 1) - 0.4) * 1.6, -0.7, 0.7);
  const roll = Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x);

  const right = buildEar(landmarks, LANDMARKS.right, "right", nose, iod, view, mirror);
  const left = buildEar(landmarks, LANDMARKS.left, "left", nose, iod, view, mirror);
  if (!right || !left) return null;

  right.visibility = visibilityFromYaw(yaw, right.outward) * depthVisibility(right.z, left.z);
  left.visibility = visibilityFromYaw(yaw, left.outward) * depthVisibility(left.z, right.z);

  const oval = FACE_OVAL
    .map((index) => toScreen(landmarks, index, view, mirror))
    .filter(Boolean);

  return {
    pose: { yaw, pitch, roll },
    iodPx: iod,
    pxPerMm: iod / IPD_MM,
    ears: { right, left },
    oval,
    nose,
    midX,
  };
}

function buildEar(landmarks, ids, body, nose, iod, view, mirror) {
  const tragus = toScreen(landmarks, ids.tragus, view, mirror);
  const temple = toScreen(landmarks, ids.temple, view, mirror);
  const jaw = toScreen(landmarks, ids.jaw, view, mirror);
  if (!tragus || !temple || !jaw) return null;

  // The jaw landmark sits on the cheek, so the lobule is measured from the tragion:
  // about 11 mm down and a few millimetres outward, instead of sliding along the jaw.
  const lobe = shiftOut(tragus, nose, iod * 0.18, iod * 0.06);
  const superior = shiftOut(temple, nose, -iod * 0.08, iod * 0.12);
  const helix = shiftOut(tragus, nose, -iod * 0.26, iod * 0.11);
  const outward = Math.sign(tragus.x - nose.x) || (body === "right" ? -1 : 1);

  return {
    body,
    tragus,
    temple,
    jaw,
    superior,
    helix,
    lobe,
    outward,
    z: tragus.z,
    visibility: 1,
  };
}

export function toScreen(landmarks, index, view, mirror) {
  const point = landmarks[index];
  if (!point) return null;
  const nx = mirror ? 1 - point.x : point.x;
  return {
    x: view.x + nx * view.w,
    y: view.y + point.y * view.h,
    z: point.z || 0,
  };
}

function shiftOut(point, nose, down, outward) {
  const sign = Math.sign(point.x - nose.x) || 1;
  return {
    x: point.x + sign * outward,
    y: point.y + down,
    z: point.z || 0,
  };
}

export function shrinkPolygon(points, scale) {
  if (!points.length) return [];
  let cx = 0;
  let cy = 0;
  for (const point of points) {
    cx += point.x;
    cy += point.y;
  }
  cx /= points.length;
  cy /= points.length;
  return points.map((point) => ({
    x: cx + (point.x - cx) * scale,
    y: cy + (point.y - cy) * scale,
  }));
}

export function eulerFromMatrix(matrix) {
  const data = matrix?.data || matrix;
  if (!data || data.length < 11) return null;
  const r00 = data[0];
  const r10 = data[1];
  const r20 = data[2];
  const r21 = data[6];
  const r22 = data[10];
  return {
    yaw: Math.atan2(r10, r00),
    pitch: Math.asin(clamp(-r20, -1, 1)),
    roll: Math.atan2(r21, r22),
  };
}
