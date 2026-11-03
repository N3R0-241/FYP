import { state } from "./state.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let visionModule = null;
let filesetPromise = null;
let imageLandmarker = null;
let videoLandmarker = null;
let lastVideoTs = 0;
const pending = { IMAGE: null, VIDEO: null };

function loadVisionModule() {
  if (!visionModule) {
    visionModule = import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21").catch((error) => {
      visionModule = null;
      throw error;
    });
  }
  return visionModule;
}

function loadFileset() {
  if (!filesetPromise) {
    filesetPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await loadVisionModule();
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      return { FaceLandmarker, fileset };
    })().catch((error) => {
      filesetPromise = null;
      throw error;
    });
  }
  return filesetPromise;
}

function createLandmarker(FaceLandmarker, fileset, runningMode) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: MODEL,
      // CPU avoids a long GPU attempt that often fails and has to start over.
      delegate: "CPU",
    },
    runningMode,
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

// Image and video each get their own landmarker. Switching one landmarker
// between those modes breaks the second camera start or the second photo.
export function initVision(mode = "IMAGE") {
  const existing = mode === "VIDEO" ? videoLandmarker : imageLandmarker;
  if (existing) {
    state.modelReady = true;
    state.runningMode = mode;
    state.landmarker = existing;
    state.status = "Face model ready.";
    return Promise.resolve(true);
  }
  if (pending[mode]) return pending[mode];
  state.status = "Loading the face model…";
  pending[mode] = loadFileset()
    .then(async ({ FaceLandmarker, fileset }) => {
      if (mode === "VIDEO") {
        videoLandmarker = videoLandmarker || await createLandmarker(FaceLandmarker, fileset, "VIDEO");
        lastVideoTs = 0;
      } else {
        imageLandmarker = imageLandmarker || await createLandmarker(FaceLandmarker, fileset, "IMAGE");
      }
      state.runningMode = mode;
      state.landmarker = mode === "VIDEO" ? videoLandmarker : imageLandmarker;
      state.modelReady = true;
      state.modelError = "";
      state.status = "Face model ready.";
      toggleRetry(false);
      return true;
    })
    .catch((error) => {
      state.modelReady = false;
      state.modelError = error?.message || "The face model could not be loaded.";
      state.status = `Face model unavailable. The studio mannequin still runs. ${state.modelError}`;
      toggleRetry(true);
      return false;
    })
    .finally(() => {
      pending[mode] = null;
    });
  return pending[mode];
}

export function videoTrackerReady() {
  return Boolean(videoLandmarker);
}

export function detectVideo(video, now) {
  if (!videoLandmarker) return null;
  const timestamp = Math.max(lastVideoTs + 1, Math.round(now));
  lastVideoTs = timestamp;
  return videoLandmarker.detectForVideo(video, timestamp);
}

export async function detectStill(image) {
  const ready = await initVision("IMAGE");
  if (!ready || !imageLandmarker) return null;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.videoWidth || image.width;
  canvas.height = image.naturalHeight || image.videoHeight || image.height;
  canvas.getContext("2d").drawImage(image, 0, 0);
  try {
    return imageLandmarker.detect(canvas);
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
