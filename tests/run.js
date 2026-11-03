import { FilterBank, OneEuroFilter } from "../js/oneEuro.js";
import { filterProducts, normalizeProduct } from "../js/catalog.js";
import { hoopWidth, sampleHoop, shadeMetal } from "../js/geom.js";
import { analyzeFace, visibilityFromYaw } from "../js/tracking.js";

let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}

function frontalFace() {
  const landmarks = [];
  const put = (index, x, y, z = 0) => {
    landmarks[index] = { x, y, z };
  };
  put(33, 0.36, 0.4);
  put(263, 0.64, 0.4);
  put(1, 0.5, 0.56);
  put(152, 0.5, 0.82);
  put(234, 0.28, 0.48);
  put(454, 0.72, 0.48);
  put(127, 0.3, 0.32);
  put(356, 0.7, 0.32);
  put(132, 0.33, 0.66);
  put(361, 0.67, 0.66);
  return landmarks;
}

const quiet = new OneEuroFilter({ minCutoff: 1, beta: 0, dCutoff: 1 });
let rawError = 0;
let smoothError = 0;
for (let i = 0; i < 90; i += 1) {
  const raw = 10 + (i % 2 === 0 ? 2 : -2);
  const smoothed = quiet.filter(raw, i / 30);
  if (i > 30) {
    rawError += Math.abs(raw - 10);
    smoothError += Math.abs(smoothed - 10);
  }
}
assert(smoothError < rawError * 0.5, "One Euro filter should cut high-frequency noise");

const step = new OneEuroFilter({ minCutoff: 1.5, beta: 0.5, dCutoff: 1 });
let settled = 0;
for (let i = 0; i < 45; i += 1) settled = step.filter(i < 5 ? 0 : 20, i / 30);
assert(Math.abs(settled - 20) < 1, `step response should arrive near 20, got ${settled}`);

const bank = new FilterBank();
const a = bank.filter("a", 1, 0, { minCutoff: 1, beta: 0 });
const b = bank.filter("b", 5, 0, { minCutoff: 1, beta: 0 });
assert(a === 1 && b === 5, "filter bank keeps independent channels");

const matches = filterProducts(
  [
    { name: "Classic Hoop", style: "hoop", material: "gold", metal: "gold", size: "medium", sku: "AU-HP-004", description: "gold ring" },
    { name: "Pearl Stud", style: "stud", material: "pearl", metal: "pearl", size: "small", sku: "AU-ST-014", description: "pearl" },
  ],
  { q: "hoop", style: "hoop", material: "gold", size: "medium" },
);
assert(matches.length === 1 && matches[0].name === "Classic Hoop", "catalog filters combine search and facets");

const custom = normalizeProduct({ name: "  Test  ", style: "nope", price: -4, radiusMm: 400, gem: "blue" }, "custom-1");
assert(custom.id === "custom-1", "normalize keeps the existing id");
assert(custom.style === "stud", "unknown style falls back to stud");
assert(custom.price === 0 && custom.radiusMm === 36, "numbers are clamped");
assert(custom.gem === "#e7eefc", "gem color must be a hex code");

const view = { x: 0, y: 0, w: 640, h: 480 };
const front = analyzeFace(frontalFace(), view, false);
assert(front, "frontal landmarks should produce a face");
assert(Math.abs(front.pose.yaw) < 0.15, `frontal yaw should be near 0, got ${front.pose.yaw}`);
assert(front.ears.right.lobe.x < front.ears.right.tragus.x, "image-left lobule sits outside the tragion");
assert(front.ears.left.lobe.x > front.ears.left.tragus.x, "image-right lobule sits outside the tragion");
assert(front.ears.right.lobe.y > front.ears.right.tragus.y, "lobule is below the tragion");
assert(front.ears.right.visibility > 0.8 && front.ears.left.visibility > 0.8, "both ears stay visible when the face is frontal");
assert(Math.abs(front.ears.right.lobe.x - front.nose.x) > Math.abs(front.ears.right.tragus.x - front.nose.x) - 1, "lobule is farther from the nose than the tragion");

const turned = frontalFace();
turned[1] = { x: 0.62, y: 0.56, z: 0 };
const turnedFace = analyzeFace(turned, view, false);
assert(turnedFace.ears.right.visibility > turnedFace.ears.left.visibility, "nose moving right brings the wearer's right ear forward");

const mirrored = analyzeFace(frontalFace(), view, true);
assert(mirrored.ears.right.lobe.x > mirrored.nose.x, "a mirrored selfie puts the wearer's right ear on screen right");
assert(
  Math.abs(mirrored.ears.right.lobe.x - mirrored.nose.x) > Math.abs(mirrored.ears.right.tragus.x - mirrored.nose.x) - 1,
  "mirrored lobule is still pushed outward",
);

assert(visibilityFromYaw(0, 1) === 1 && visibilityFromYaw(0, -1) === 1, "frontal yaw shows both ears");
assert(visibilityFromYaw(0.8, 1) < 0.2, "the ear on screen right hides when the nose moves right");
assert(visibilityFromYaw(0.8, -1) === 1, "the ear on screen left stays visible when the nose moves right");

const frontWidth = hoopWidth(0, 1);
const awayWidth = hoopWidth(0.75, 1);
const nearWidth = hoopWidth(-0.75, 1);
assert(Math.abs(hoopWidth(0, 1) - hoopWidth(0, -1)) < 1, "both hoops match when the head is straight");
assert(nearWidth > frontWidth, "the near ear's hoop opens as the head turns");
assert(awayWidth < frontWidth, "the far ear's hoop narrows as the head turns");

const top = sampleHoop(Math.PI, 14, { yaw: 0, pitch: 0, roll: 0 }, 1, 1);
const bottom = sampleHoop(0, 14, { yaw: 0, pitch: 0, roll: 0 }, 1, 1);
assert(Math.abs(top.y) < 1, "the top of the hoop meets the piercing");
assert(bottom.y > top.y + 20, "the hoop hangs below the piercing");

const rgb = shadeMetal("gold", { x: 0, y: -0.2, z: 1 });
assert(rgb.length === 3 && rgb.every((channel) => channel >= 0 && channel <= 255), "metal shader stays in byte range");

if (failed) {
  console.error(`${failed} test(s) failed`);
  process.exit(1);
}
console.log("all tests passed");
