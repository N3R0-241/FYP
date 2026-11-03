import { FilterBank } from "./oneEuro.js";
import { drawEarring, drawMannequin, refillHead, clipRedraw } from "./render.js";
import { state } from "./state.js";
import { analyzeFace, eulerFromMatrix, shrinkPolygon, visibilityFromYaw } from "./tracking.js";
import { detectVideo, initVision, videoTrackerReady } from "./vision.js";

let lastFrame = performance.now();

export function mountSketch(host) {
  const P5 = window.p5;
  if (!P5) {
    state.status = "p5.js did not load. Reload the page once the network is available.";
    return null;
  }
  state.filters = new FilterBank();
  state.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sketch = new P5((p) => {
    p.setup = () => {
      p.createCanvas(host.clientWidth || 640, host.clientHeight || 480);
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      p.frameRate(30);
      const observer = new ResizeObserver(() => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (width > 2 && height > 2) p.resizeCanvas(width, height);
      });
      observer.observe(host);
    };

    p.draw = () => {
      try {
        const now = performance.now();
        const dt = now - lastFrame;
        lastFrame = now;
        state.metrics.fps = state.metrics.fps ? state.metrics.fps * 0.9 + (1000 / Math.max(dt, 1)) * 0.1 : 30;
        p.background(22, 18, 15);
        const view = { x: 0, y: 0, w: p.width, h: p.height };

        if (state.mode === "camera" && state.video && state.video.readyState >= 2 && state.video.videoWidth > 0) {
          drawLive(p, view, now);
        } else if (state.mode === "photo" && state.photo) {
          drawPhoto(p, view, now);
        } else {
          drawStudio(p, view, now);
        }
        drawSpark();
        publishMetrics();
      } catch (error) {
        state.status = error?.message || "The preview hit an error. Reload the page.";
        publishMetrics();
      }
    };
  }, host);

  state.sketch = sketch;
  return sketch;
}

function drawStudio(p, view, now) {
  const yaw = state.mannequinYaw;
  const pitch = state.mannequinPitch;
  const studio = drawMannequin(p, view, yaw, pitch);
  studio.ears.left.visibility = visibilityFromYaw(yaw, studio.ears.left.outward);
  studio.ears.right.visibility = visibilityFromYaw(yaw, studio.ears.right.outward);
  const pose = { yaw, pitch, roll: (state.fit.rot * Math.PI) / 180 };
  const product = selectedProduct();
  const ears = ["left", "right"].map((body) => decorateEar(studio.ears[body], pose, studio.pxPerMm, now, body));
  if (product) {
    for (const ear of ears) {
      if (!earVisible(ear.body)) continue;
      drawEarring(p, product, ear, pose, stepSwing(ear.body, ear.lobe.y, now), productImage(product));
    }
  }
  refillHead(p, studio.head);
  if (state.showAnchors && product) {
    for (const ear of ears) paintAnchors(p, ear);
  }
  state.metrics.faces = 0;
  state.metrics.yaw = pose.yaw;
  state.metrics.pitch = pose.pitch;
  state.metrics.roll = pose.roll;
  state.metrics.pxPerMm = studio.pxPerMm * state.fit.scale;
  state.metrics.matrixYaw = null;
  rememberTrace(ears.find((ear) => ear.body === "right"));
}

function drawLive(p, view, now) {
  const video = state.video;
  const fitted = fitRect(video.videoWidth, video.videoHeight, view.w, view.h, 0);
  drawMedia(p, video, fitted, state.mirror);
  const started = performance.now();
  let landmarks = null;
  let matrix = null;
  if (!videoTrackerReady()) {
    if (!state.modeSwitching && !state.modelError) {
      state.modeSwitching = true;
      initVision("VIDEO").finally(() => {
        state.modeSwitching = false;
      });
    }
  } else {
    try {
      const result = detectVideo(video, now);
      landmarks = result?.faceLandmarks?.[0] || null;
      matrix = result?.facialTransformationMatrixes?.[0] || null;
    } catch (error) {
      state.status = `Tracking paused: ${error.message || "detect failed"}`;
    }
  }
  state.metrics.detectMs = performance.now() - started;
  paintTracked(p, landmarks, matrix, fitted, state.mirror, now, video);
}

function drawPhoto(p, view, now) {
  const image = state.photo;
  const fitted = fitRect(image.naturalWidth || image.width, image.naturalHeight || image.height, view.w, view.h, 0);
  drawMedia(p, image, fitted, state.mirror);
  state.metrics.detectMs = 0;
  paintTracked(p, state.photoLandmarks, state.photoMatrix, fitted, state.mirror, now, image);
}

function paintTracked(p, landmarks, matrix, view, mirror, now, media) {
  if (!landmarks) {
    state.faceMiss += 1;
    state.metrics.faces = 0;
    if (state.faceMiss > 8) state.filters.reset();
    return;
  }
  state.faceMiss = 0;
  const analysis = analyzeFace(landmarks, view, mirror);
  if (!analysis) return;
  const pose = {
    yaw: smooth("pose.yaw", analysis.pose.yaw, now, true),
    pitch: smooth("pose.pitch", analysis.pose.pitch, now, true),
    roll: smooth("pose.roll", analysis.pose.roll, now, true) + (state.fit.rot * Math.PI) / 180,
  };
  const product = selectedProduct();
  const ears = ["right", "left"].map((body) => {
    const source = analysis.ears[body];
    return decorateEar(source, pose, analysis.pxPerMm, now, body);
  });
  if (product) {
    for (const ear of ears) {
      if (!earVisible(ear.body)) continue;
      drawEarring(p, product, ear, pose, stepSwing(ear.body, ear.lobe.y, now), productImage(product));
    }
    const oval = shrinkPolygon(analysis.oval, 0.93);
    clipRedraw(p, media, view, mirror, oval, (item, rect, flipped) => drawMedia(p, item, rect, flipped));
  }
  if (state.showMesh) paintMesh(p, analysis);
  if (state.showAnchors) {
    for (const ear of ears) paintAnchors(p, ear);
  }
  const euler = eulerFromMatrix(matrix);
  state.metrics.faces = 1;
  state.metrics.yaw = pose.yaw;
  state.metrics.pitch = pose.pitch;
  state.metrics.roll = pose.roll;
  state.metrics.matrixYaw = euler ? euler.yaw : null;
  state.metrics.pxPerMm = analysis.pxPerMm * state.fit.scale;
  rememberTrace(ears.find((ear) => ear.body === "right"));
}

function decorateEar(ear, pose, pxPerMm, now, body) {
  const noisy = addNoise(ear, now, body);
  const lobe = {
    x: smooth(`${body}.lx`, noisy.lobe.x, now, false) + state.fit.x,
    y: smooth(`${body}.ly`, noisy.lobe.y, now, false) + state.fit.y,
  };
  const helix = {
    x: smooth(`${body}.hx`, noisy.helix.x, now, false) + state.fit.x,
    y: smooth(`${body}.hy`, noisy.helix.y, now, false) + state.fit.y,
  };
  return {
    ...ear,
    rawLobe: noisy.lobe,
    filteredLobe: { x: lobe.x - state.fit.x, y: lobe.y - state.fit.y },
    lobe,
    helix,
    pxPerMm: pxPerMm * state.fit.scale,
    pose,
  };
}

function addNoise(ear, now, body) {
  if (!(state.mode === "mannequin" && state.demoNoise)) return ear;
  const wobble = Math.sin(now / 40 + (body === "right" ? 0 : 1.3)) * 1.6
    + Math.sin(now / 17) * 0.8;
  return {
    ...ear,
    lobe: { x: ear.lobe.x + wobble, y: ear.lobe.y + wobble * 0.35 },
    helix: { x: ear.helix.x + wobble, y: ear.helix.y + wobble * 0.35 },
  };
}

function smooth(key, value, now, angle) {
  if (!state.smoothing || !state.filters) return value;
  return state.filters.filter(key, value, now / 1000, {
    minCutoff: state.minCutoff,
    beta: angle ? state.beta * 0.02 : state.beta,
    dCutoff: 1,
  });
}

function earVisible(body) {
  return state.fit.ears === "both" || state.fit.ears === body;
}

function stepSwing(body, y, now) {
  const swing = state.swing[body];
  if (!swing.lastT) {
    swing.lastT = now;
    swing.lastY = y;
    return 0;
  }
  const dt = Math.min(0.05, Math.max(0.001, (now - swing.lastT) / 1000));
  const velocity = (y - swing.lastY) / dt;
  swing.lastY = y;
  swing.lastT = now;
  if (state.reduceMotion) {
    swing.angle = 0;
    swing.vel = 0;
    return 0;
  }
  const drive = Math.max(-0.45, Math.min(0.45, velocity / 1800));
  swing.vel += (18 * (drive - swing.angle) - 5.5 * swing.vel) * dt;
  swing.angle = Math.max(-0.6, Math.min(0.6, swing.angle + swing.vel * dt));
  return swing.angle;
}

function rememberTrace(ear) {
  if (!ear) return;
  const raw = ear.rawLobe?.x ?? ear.lobe.x;
  const filtered = ear.filteredLobe?.x ?? ear.lobe.x;
  state.metrics.jitter = Math.abs(raw - filtered);
  state.trace.push({ raw, filtered });
  if (state.trace.length > 180) state.trace.shift();
}

function paintAnchors(p, ear) {
  dot(p, ear.superior, [231, 211, 161]);
  dot(p, ear.tragus, [208, 122, 98]);
  dot(p, ear.lobe, [244, 239, 230]);
}

function paintMesh(p, analysis) {
  p.noFill();
  p.stroke(231, 211, 161, 140);
  p.strokeWeight(1);
  p.beginShape();
  for (const point of analysis.oval) p.vertex(point.x, point.y);
  p.endShape(p.CLOSE);
  dot(p, analysis.nose, [244, 239, 230]);
}

function dot(p, point, rgb) {
  if (!point) return;
  p.noStroke();
  p.fill(rgb[0], rgb[1], rgb[2]);
  p.circle(point.x, point.y, 6);
}

function drawMedia(p, media, view, mirror) {
  const ctx = p.drawingContext;
  ctx.save();
  if (mirror) {
    ctx.translate(view.x + view.w, view.y);
    ctx.scale(-1, 1);
    ctx.drawImage(media, 0, 0, view.w, view.h);
  } else {
    ctx.drawImage(media, view.x, view.y, view.w, view.h);
  }
  ctx.restore();
}

function fitRect(srcW, srcH, dstW, dstH, margin) {
  const availW = Math.max(1, dstW - margin * 2);
  const availH = Math.max(1, dstH - margin * 2);
  const scale = Math.min(availW / srcW, availH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

function selectedProduct() {
  return state.products.find((product) => product.id === state.selectedId) || null;
}

function productImage(product) {
  if (!product?.imageDataUrl) return null;
  const cached = state.imageCache.get(product.id);
  if (cached && cached.url === product.imageDataUrl && cached.ready) return cached.img;
  if (!cached || cached.url !== product.imageDataUrl) {
    const img = new Image();
    const record = { url: product.imageDataUrl, img, ready: false };
    img.onload = () => {
      record.ready = true;
    };
    img.src = product.imageDataUrl;
    state.imageCache.set(product.id, record);
  }
  return null;
}

function publishMetrics() {
  const text = (id, value) => {
    const node = document.getElementById(id);
    if (node && node.textContent !== value) node.textContent = value;
  };
  const deg = (radians) => `${((radians * 180) / Math.PI).toFixed(0)}°`;
  text("metric-fps", state.metrics.fps.toFixed(0));
  text("metric-detect", state.mode === "camera" ? `${state.metrics.detectMs.toFixed(1)} ms` : "—");
  text("metric-yaw", deg(state.metrics.yaw));
  text("metric-pitch", deg(state.metrics.pitch));
  text("metric-roll", deg(state.metrics.roll));
  text("metric-matrix", state.metrics.matrixYaw == null ? "—" : deg(state.metrics.matrixYaw));
  text("metric-jitter", `${state.metrics.jitter.toFixed(1)} px`);
  text("metric-scale", state.metrics.pxPerMm ? `${state.metrics.pxPerMm.toFixed(2)} px/mm` : "—");
  text("metric-faces", String(state.metrics.faces));
  const pill = document.getElementById("mode-pill");
  if (pill) {
    const label = state.mode === "camera"
      ? (state.metrics.faces ? "Live camera" : "Live camera · no face")
      : state.mode === "photo"
        ? (state.photoLandmarks ? "Uploaded photo" : "Uploaded photo · no face")
        : "Studio mannequin";
    if (pill.textContent !== label) pill.textContent = label;
  }
}

function drawSpark() {
  const canvas = document.getElementById("spark");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const samples = state.trace;
  if (samples.length < 2) return;
  let min = Infinity;
  let max = -Infinity;
  for (const sample of samples) {
    min = Math.min(min, sample.raw, sample.filtered);
    max = Math.max(max, sample.raw, sample.filtered);
  }
  const span = Math.max(8, max - min);
  const xAt = (index) => (index / (samples.length - 1)) * (width - 8) + 4;
  const yAt = (value) => height - 6 - ((value - min) / span) * (height - 12);
  strokeSeries(ctx, samples, xAt, yAt, "raw", "#8d8072");
  strokeSeries(ctx, samples, xAt, yAt, "filtered", "#e7d3a1");
}

function strokeSeries(ctx, samples, xAt, yAt, key, color) {
  ctx.beginPath();
  samples.forEach((sample, index) => {
    const x = xAt(index);
    const y = yAt(sample[key]);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = key === "filtered" ? 2 : 1;
  ctx.stroke();
}
