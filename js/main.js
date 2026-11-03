import { loadDb } from "./catalog.js";
import { mountSketch } from "./sketch.js";
import { state } from "./state.js";
import { bindUi, selectProduct } from "./ui.js";
import { detectStill, initVision } from "./vision.js";

const db = loadDb();
state.products = db.products;
state.comments = db.comments;
state.selectedId = db.products[0]?.id || "";

bindUi();
selectProduct(state.selectedId);
mountSketch(document.getElementById("canvas-host"));
document.body.dataset.mode = "mannequin";

document.getElementById("start-camera").addEventListener("click", startCamera);
document.getElementById("upload-photo").addEventListener("click", () => document.getElementById("photo-input").click());
document.getElementById("photo-input").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) usePhoto(file);
  event.target.value = "";
});
document.getElementById("mannequin").addEventListener("click", () => {
  stopCamera();
  state.photo = null;
  state.photoLandmarks = null;
  state.mode = "mannequin";
  state.mirror = false;
  syncMirror();
  state.filters?.reset();
  document.body.dataset.mode = "mannequin";
  state.status = state.modelReady ? "Studio mannequin. Turn the head with the slider." : state.status;
  setStatus();
});
document.getElementById("snapshot").addEventListener("click", () => {
  state.sketch?.saveCanvas("auricle-try-on", "png");
});
document.getElementById("retry-model").addEventListener("click", () => {
  initVision().then(setStatus);
});

const stage = document.getElementById("stage");
stage.addEventListener("dragover", (event) => event.preventDefault());
stage.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files?.[0];
  if (file && file.type.startsWith("image/")) usePhoto(file);
});

document.addEventListener("keydown", (event) => {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const ids = state.products.map((product) => product.id);
  const index = ids.indexOf(state.selectedId);
  if (index < 0) return;
  const next = event.key === "ArrowRight" ? (index + 1) % ids.length : (index - 1 + ids.length) % ids.length;
  selectProduct(ids[next]);
});

setStatus();
setInterval(setStatus, 500);

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    state.status = "This browser cannot open a camera. Use the mannequin or upload a photo.";
    setStatus();
    return;
  }
  stopCamera();
  state.status = "Loading the face model…";
  setStatus();
  try {
    await initVision();
    setStatus();
    if (!state.modelReady) return;
    state.status = "Waiting for camera permission…";
    setStatus();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    state.video = video;
    state.cameraReady = true;
    state.photo = null;
    state.photoLandmarks = null;
    state.mode = "camera";
    state.mirror = true;
    syncMirror();
    state.filters?.reset();
    document.body.dataset.mode = "camera";
    state.status = state.modelReady ? "Camera on. Face the lens with both ears in frame." : "Camera on. The face model is still loading.";
  } catch (error) {
    state.mode = "mannequin";
    document.body.dataset.mode = "mannequin";
    state.status = `Camera unavailable. ${error?.message || "Permission was blocked."}`;
  }
  setStatus();
}

async function usePhoto(file) {
  stopCamera();
  state.status = "Reading the photo…";
  setStatus();
  try {
    const image = await loadImage(file);
    state.photo = image;
    state.photoLandmarks = null;
    state.photoMatrix = null;
    state.mode = "photo";
    state.mirror = false;
    syncMirror();
    state.filters?.reset();
    document.body.dataset.mode = "photo";
    state.status = "Loading the face model…";
    setStatus();
    await initVision();
    if (!state.modelReady) {
      setStatus();
      return;
    }
    state.status = "Looking for a face…";
    setStatus();
    const result = await detectStill(image);
    state.photoLandmarks = result?.faceLandmarks?.[0] || null;
    state.photoMatrix = result?.facialTransformationMatrixes?.[0] || null;
    state.status = state.photoLandmarks
      ? "Photo ready. Nudge the fit if the earring sits a little off the lobe."
      : "No face found. Use a front-facing photo with the ears visible.";
  } catch (error) {
    state.status = error?.message || "Could not open that image.";
  }
  setStatus();
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    image.src = url;
  });
}

function stopCamera() {
  const video = state.video;
  if (video?.srcObject) {
    for (const track of video.srcObject.getTracks()) track.stop();
    video.srcObject = null;
  }
  state.video = null;
  state.cameraReady = false;
}

function syncMirror() {
  const box = document.getElementById("mirror");
  if (box) box.checked = state.mirror;
}

function setStatus() {
  const node = document.getElementById("status");
  if (node) node.textContent = state.status;
}
