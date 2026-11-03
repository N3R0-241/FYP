import { state } from "./state.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let visionModule = null;
let loadPromise = null;

async function loadVisionModule() {
  if (!visionModule) {
    visionModule = import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21").catch((error) => {
      visionModule = null;
      throw error;
    });
  }
  return visionModule;
}

export function initVision() {
  if (state.modelReady) return Promise.resolve(true);
  if (loadPromise) return loadPromise;
  state.status = "Loading the face model…";
  loadPromise = startVision().finally(() => {
    if (!state.modelReady) loadPromise = null;
  });
  return loadPromise;
}

async function startVision() {
  try {
    const { FaceLandmarker, FilesetResolver } = await loadVisionModule();
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    // CPU starts straight away. The GPU delegate often spends a long time failing
    // before the same model is created again on CPU.
    state.landmarker = await createLandmarker(FaceLandmarker, fileset, "CPU");
    state.runningMode = "IMAGE";
    state.modelReady = true;
    state.modelError = "";
    state.status = "Face model ready. Start the camera or upload a photo.";
    toggleRetry(false);
  } catch (error) {
    state.modelReady = false;
    state.landmarker = null;
    state.modelError = error?.message || "The face model could not be loaded.";
    state.status = `Face model unavailable. The studio mannequin still runs. ${state.modelError}`;
    toggleRetry(true);
  }
}

function createLandmarker(FaceLandmarker, fileset, delegate) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL,
      delegate,
    },
    runningMode: "IMAGE",
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

export async function ensureRunningMode(mode) {
  if (!state.landmarker) return false;
  if (state.runningMode === mode) return true;
  if (state.modeSwitching) return false;
  state.modeSwitching = true;
  try {
    await state.landmarker.setOptions({ runningMode: mode });
    state.runningMode = mode;
    return true;
  } catch (error) {
    state.status = `Could not switch the tracker: ${error?.message || "mode change failed"}`;
    return false;
  } finally {
    state.modeSwitching = false;
  }
}

export async function detectStill(image) {
  if (!state.landmarker) return null;
  const ready = await ensureRunningMode("IMAGE");
  if (!ready) return null;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.videoWidth;
  canvas.height = image.naturalHeight || image.videoHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  try {
    return state.landmarker.detect(canvas);
  } catch (error) {
    state.status = `Photo tracking failed: ${error?.message || "detect failed"}`;
    return null;
  }
}

function toggleRetry(show) {
  const button = document.getElementById("retry-model");
  if (!button) return;
  button.hidden = !show;
}
