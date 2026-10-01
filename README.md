# NOCTIS — Phantom Air · scroll-driven landing page

A static site (no build step): `index.html`, `style.css` and `main.js`, plus pre-extracted WebP frame sequences. Two 8-second films play frame by frame as you scroll. Each frame is drawn to a full-screen `<canvas>` and driven by one scrubbed GSAP ScrollTrigger timeline, with Lenis smooth scrolling on top.

```
index.html          markup + overlays
style.css           design system, layout, reduced-motion fallback
main.js             CONFIG at the top, then preloader / canvas / timeline / interactions
frames/v1, v2       1920px WebP sequences (desktop)
frames/mobile/v1,v2 960px WebP sequences (≤768px wide screens)
assets/video        the source MP4s (used only to regenerate frames)
```

## Run it locally

Serve the folder over HTTP rather than opening `index.html` from disk (browsers restrict some `file://` loads):

```bash
python3 -m http.server 8000      # then open http://localhost:8000
# or: npx serve .
```

Change the brand, product name and price in `CONFIG` (`brand`, `product`, `price`). Every element marked `data-bind` picks the new values up automatically.

---

## 1. Extracting the frames (ffmpeg)

Both sources are 1920×1080 at 24 fps and 8 s long, so each gives 192 frames. Frame numbers start at 1 (`frame_0001.webp`).

**Desktop set (1920px):**

```bash
mkdir -p frames/v1 frames/v2

ffmpeg -i video-1.mp4 -vf "scale=1920:-2:flags=lanczos" \
  -c:v libwebp -quality 72 -compression_level 6 -preset photo \
  frames/v1/frame_%04d.webp

ffmpeg -i video-2.mp4 -vf "scale=1920:-2:flags=lanczos" \
  -c:v libwebp -quality 72 -compression_level 6 -preset photo \
  frames/v2/frame_%04d.webp
```

**Mobile set (960px):**

```bash
mkdir -p frames/mobile/v1 frames/mobile/v2

ffmpeg -i video-1.mp4 -vf "scale=960:-2:flags=lanczos" \
  -c:v libwebp -quality 70 -compression_level 6 -preset photo \
  frames/mobile/v1/frame_%04d.webp

ffmpeg -i video-2.mp4 -vf "scale=960:-2:flags=lanczos" \
  -c:v libwebp -quality 70 -compression_level 6 -preset photo \
  frames/mobile/v2/frame_%04d.webp
```

Expected weight with these settings: about 20 MB for the desktop set and about 8 MB for the mobile set.

Options:
- Fewer frames: add `fps=12` before `scale`, e.g. `-vf "fps=12,scale=1920:-2:flags=lanczos"`. This halves the payload. Set `count: 96` in CONFIG to match.
- JPG instead of WebP: use `-q:v 4 frames/v1/frame_%04d.jpg`, then change `CONFIG.fileName` to return `.jpg`.
- Check the frame count: `ls frames/v1 | wc -l` should equal `CONFIG.videos[0].count`.

### Switching between the two sets by screen width

`main.js` picks the set once, on page load:

```js
const useMobileFrames = window.innerWidth <= CONFIG.mobileBreakpoint; // 768 by default
const framePath = (v, i) =>
  (useMobileFrames ? CONFIG.videos[v].mobilePath : CONFIG.videos[v].path) + CONFIG.fileName(i);
```

The choice is made only once because swapping sets mid-session would re-download every frame. Rotating a phone or resizing a window just redraws the current set using the cover math. To go by physical pixels instead (for example, to serve 1920px to a high-DPR tablet), change the test to `window.innerWidth * Math.min(devicePixelRatio, 2) <= 1100`.

---

## 2. How the scroll timeline works

The timeline's "time" is measured in **vh of scroll**:

```
0 ───────── 300 ─── 340 ─────────────────────── 740   (vh)
   Video 1     x-fade          Video 2
```

- `videos[n].scroll` sets each film's scroll length. `crossfade` sets the length of the V1→V2 dissolve, which draws V1's last frame and V2's first frame with a smoothstep alpha.
- The pinned section lasts `(300 + 40 + 400)vh`. `scrub: 0.8` smooths the motion.
- Overlays, the flash, the 240 g counter and the sole pointer line all sit on the same timeline, so they stay locked to the footage.
- Preloading starts with every 4th frame of both videos, plus the first and last frames (needed for the seam). The loader exits once 25% of all frames are decoded. The rest load in the background. Any frame that hasn't arrived yet is replaced by the nearest decoded one.

## 3. Adjusting timing if you swap the videos

1. **Re-extract** with the commands above and set each video's `count` to the new number of files.
2. **Scroll length:** `videos[n].scroll` (vh). A good starting point is about 35–50vh per second of footage. Longer feels slower and more cinematic.
3. **Overlay windows:** `CONFIG.overlays.<name> = { video, in, out }`, with `in`/`out` as fractions (0–1) of that video. To find the right moment, scrub the source in any player and divide by the duration (e.g. 3.2 s / 8 s → `0.40`). In frames: `frameNumber / count`.
4. **Flash:** `CONFIG.flashAt` is the fraction of V2 where the shockwave lands. To find a bright hit, print per-frame brightness:
   ```bash
   ffmpeg -i video-2.mp4 -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null - | grep YAVG
   ```
   Or scan a contact sheet: `ffmpeg -i video-2.mp4 -vf "fps=3,scale=320:-1,tile=6x4" -frames:v 1 sheet.png`
5. **Sole pointer line:** `CONFIG.soleTrack` lists the air-bubble position in *image* coordinates (0–1) at a few frames. The line's endpoint interpolates between them, so it follows the camera push-in. Re-measure if the close-up changes. On narrow or portrait screens, where the crop hides the bubble, the line hides automatically.
6. **Seam:** if the new V1 doesn't end on a frame that matches V2's opening, lengthen `crossfade` (60–100vh) so the dissolve has more room.
7. **Fade speed:** `CONFIG.fade` is the share of each overlay's window spent fading in or out (0.3 = 30%).
8. **Crop:** `CONFIG.focal` works like `object-position` for the cover crop. Use something like `{ x: 0.55, y: 0.5 }` to keep an off-centre subject in frame on phones.

Note: frames ~70–140 of the current Video 1 have letterbox bars baked into the footage. That's part of the source, not a rendering bug.

## Accessibility and fallbacks

- `prefers-reduced-motion: reduce` turns off the pinning, scrubbing, Lenis, cursor and tilt. Each chapter shows as a static key frame (`data-static-frame="video:frame"` on each overlay) with a simple opacity fade.
- The same static mode is used if the GSAP CDN fails to load.
- On touch devices the custom cursor is hidden, along with the magnetic and tilt effects.
