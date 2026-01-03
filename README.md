<p align="center">
  <span style="font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace; font-size: 2em;">
    FluxASCII
  </span>
</p>

A static, browser-based tool for converting image sequences into animated ASCII art with retro terminal effects.

<p align="center">
  <strong>
    <a href="https://wwang2.github.io/flux-asicii/">Launch Live App</a>
  </strong>
  <br><br>
  <table align="center">
    <tr>
      <td>
        <img src="assets/example.gif" alt="FluxASCII Demo" width="360" height="auto">
      </td>
      <td>
        <img src="assets/catie_chloe.gif" alt="FluxASCII Catie & Chloe Demo" width="360" height="auto">
      </td>
    </tr>
  </table>
</p>

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
