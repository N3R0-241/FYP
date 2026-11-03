# Auricle

A browser earring try-on for EN4262. The page is a [p5.js](https://p5js.org/) sketch: a studio mannequin, a live camera, or an uploaded photo, with the catalog beside it.

Earrings are small 3D curves drawn in the canvas. Hoops sit in the plane of the ear, drops hang with gravity, and cuffs stay on the helix. Scale uses a 63 mm distance between the outer eye corners.

## Run

The page uses JavaScript modules, so it has to be served. Opening `index.html` by double-clicking it will not run.

From this folder:

```bash
python3 serve.py
```

On Windows, double-click `start.bat`. On Mac or Linux, double-click `start.sh` or run `python3 serve.py`.

The window prints `http://127.0.0.1:5173/` and opens it. Leave that window open while you use the site. Press Ctrl+C in it to stop.

If you run the command again while it is already open, it does not start a second server. It prints the same address and opens the page. Use that address, not a `file://` link.

`npm test` runs the geometry, tracking, catalog, and One Euro checks with Node. It does not need a browser.

The page opens on the studio mannequin and does not download the face model until you start the camera or upload a photo. That download is MediaPipe Face Landmarker. Camera permission stays in the browser; catalog edits, comments, and uploaded images stay in `localStorage`.

The admin PIN is `auricle`.

## What maps to the report

| Report idea | Where it lives |
| --- | --- |
| Face-tracking try-on, camera and still photo | `js/vision.js`, `js/sketch.js` |
| Ear anchors from a sparse face mesh (temple, tragion, jaw), then shifted out to the lobule | `js/tracking.js` |
| One Euro jitter filter, with cutoff and beta controls | `js/oneEuro.js` |
| Hoop foreshortening, gravity on drops, cuff locked to the helix, cheek occlusion | `js/geom.js`, `js/render.js` |
| Filter, search, comments | `js/catalog.js`, `js/ui.js` |
| Catalog admin and image upload | Admin dialog in `index.html` |
| Manual nudge, scale, and roll | Fit controls |

The face mesh has no dense pinna. This build estimates the three ear points instead of training a separate ear network. Shading is a real-time metal model in the canvas, not a full physically based glTF renderer. Payment, stock logistics, and an external comment service are out of scope.

Left and right in the ear menu are the wearer's ears. The camera view starts mirrored, like a selfie. Photos start unmirrored.
