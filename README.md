# FluxASCII

A static, browser-based tool for converting image sequences into animated ASCII art with retro terminal effects.

**[Launch Live App](https://wujiewang.github.io/flux-asicii/)**

![FluxASCII Demo](assets/example.gif)

## Features

- **Client-Side Processing**: No backend required; runs entirely in your browser using HTML5 Canvas.
- **Smart Interpolation**: Creates smooth transitions between images using pixel-based LERP, Wipe, Dissolve, and more.
- **Retro Effects**: CRT scanlines, bloom/glow, and chromatic aberration.
- **Customizable**: Adjust resolution, speed, contrast, and color modes (Light/Dark).
- **GIF Export**: Record your ASCII animation and download it as a seamless looping GIF.

## Usage

1. **Upload**: Drag & drop multiple images.
2. **Configure**: Tune the resolution and speed sliders.
3. **Play**: Watch the real-time ASCII conversion.
4. **Export**: Click "Make GIF" to save your creation.

## Deployment

This project is ready for GitHub Pages. Pushing to `main` triggers the included GitHub Actions workflow.

---
*Built with Vanilla JS and [gif.js](https://github.com/jnordberg/gif.js).*
