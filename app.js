// Configuration
const density = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";
const revDensity = density.split('').reverse().join('');
const FONT_FAMILY = "'Fira Code', 'Courier New', Courier, monospace";

// DOM Elements
const elements = {
    fileInput: document.getElementById('imageUpload'),
    fileCount: document.getElementById('fileCount'),
    playBtn: document.getElementById('playBtn'),
    recordBtn: document.getElementById('recordBtn'),
    recordingStatus: document.getElementById('recordingStatus'),
    recProgress: document.getElementById('recProgress'),
    transitionSelect: document.getElementById('transitionSelect'),
    speedRange: document.getElementById('speedRange'),
    speedVal: document.getElementById('speedVal'),
    resolutionRange: document.getElementById('resolutionRange'),
    resVal: document.getElementById('resVal'),
    contrastRange: document.getElementById('contrastRange'),
    contrastVal: document.getElementById('contrastVal'),
    colorToggle: document.getElementById('colorToggle'),
    invertToggle: document.getElementById('invertToggle'),
    container: document.getElementById('asciiContainer'),
    displayCanvas: document.getElementById('displayCanvas'),
    displayCtx: document.getElementById('displayCanvas').getContext('2d'),
    processCanvas: document.getElementById('processCanvas'),
    processCtx: document.getElementById('processCanvas').getContext('2d', { willReadFrequently: true })
};

// Application State
let state = {
    images: [], // { data: Uint8ClampedArray, width, height }
    originalImages: [], // Image objects
    
    // Grid dimensions
    gridW: 0,
    gridH: 0,
    
    // Animation
    currentImageIndex: 0,
    nextImageIndex: 0,
    t: 0, // Interpolation factor 0.0 -> 1.0
    isPlaying: false,
    isRecording: false,
    reqId: null,
    
    // Settings
    speed: 1.0,     // Transition speed multiplier
    resolution: 80, // Width in characters
    contrast: 1.0,
    colored: true,
    inverted: false, // Light mode
    aspectRatio: 1.0, // width / height
    transitionType: 'fade', // Default
};

// --- Initialization & Event Listeners ---

function init() {
    window.addEventListener('resize', handleResize);
    elements.fileInput.addEventListener('change', handleFileUpload);
    elements.playBtn.addEventListener('click', togglePlay);
    elements.recordBtn.addEventListener('click', startRecording);
    
    elements.transitionSelect.addEventListener('change', (e) => {
        state.transitionType = e.target.value;
    });

    elements.speedRange.addEventListener('input', (e) => {
        state.speed = parseFloat(e.target.value);
        elements.speedVal.innerText = state.speed.toFixed(1) + 'x';
    });
    
    elements.resolutionRange.addEventListener('input', (e) => {
        state.resolution = parseInt(e.target.value);
        elements.resVal.innerText = state.resolution + ' chars';
        prepareImages(); // Re-scale images to new resolution
    });
    
    elements.contrastRange.addEventListener('input', (e) => {
        state.contrast = parseFloat(e.target.value);
        elements.contrastVal.innerText = state.contrast;
        if (!state.isPlaying) renderFrame(); // Live update if paused
    });
    
    elements.colorToggle.addEventListener('change', (e) => {
        state.colored = e.target.checked;
        if (!state.isPlaying) renderFrame();
    });

    elements.invertToggle.addEventListener('change', (e) => {
        state.inverted = e.target.checked;
        if (state.inverted) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        if (!state.isPlaying) renderFrame();
    });
    
    // Initial resize to set canvas defaults
    handleResize();
}

function handleResize() {
    const rect = elements.container.getBoundingClientRect();
    const containerW = rect.width;
    const containerH = rect.height;
    
    // Default to container size if no images
    if (state.images.length === 0) {
        elements.displayCanvas.width = containerW;
        elements.displayCanvas.height = containerH;
        return;
    }

    // Use the effective aspect ratio of our grid
    const targetAspect = (state.gridW * 0.6) / state.gridH;

    let canvasW, canvasH;

    if (containerW / containerH > targetAspect) {
        // Container is wider than target -> constrain by height
        canvasH = containerH;
        canvasW = containerH * targetAspect;
    } else {
        // Container is taller than target -> constrain by width
        canvasW = containerW;
        canvasH = containerW / targetAspect;
    }

    elements.displayCanvas.width = canvasW;
    elements.displayCanvas.height = canvasH;

    if (!state.isPlaying) {
        renderFrame();
    }
}

async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Reset State
    stopAnimation();
    state.isPlaying = false;
    elements.playBtn.innerText = "Play";
    elements.recordBtn.disabled = true;
    
    elements.fileCount.innerText = "Loading...";
    
    state.originalImages = [];
    files.sort((a, b) => a.name.localeCompare(b.name));

    try {
        for (const file of files) {
            const img = await loadImage(file);
            state.originalImages.push(img);
        }
        
        if (state.originalImages.length > 0) {
            // Set aspect ratio from the FIRST image
            const first = state.originalImages[0];
            state.aspectRatio = first.width / first.height;
            
            elements.fileCount.innerText = `${files.length} images loaded`;
            elements.recordBtn.disabled = false;
            
            prepareImages();
            
            // Auto start if user wants? Or just show first frame
            state.currentImageIndex = 0;
            state.nextImageIndex = (state.originalImages.length > 1) ? 1 : 0;
            state.t = 0;
            renderFrame();
        }
    } catch (err) {
        console.error(err);
        elements.fileCount.innerText = "Error loading images";
    }
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// --- Processing ---

function prepareImages() {
    if (state.originalImages.length === 0) return;

    // 1. Calculate process canvas size
    // Width is fixed by resolution slider
    // Height is derived from aspect ratio * char aspect ratio correction
    // Fonts are usually ~0.6 aspect ratio (width/height)
    const charAspect = 0.6; 
    const w = state.resolution;
    const h = Math.floor(w / state.aspectRatio * charAspect);

    // Save grid dimensions
    state.gridW = w;
    state.gridH = h;
    
    elements.processCanvas.width = w;
    elements.processCanvas.height = h;

    // 2. Process all images into pixel buffers
    state.images = state.originalImages.map(img => {
        // Draw image stretched to process canvas size
        elements.processCtx.clearRect(0, 0, w, h);
        elements.processCtx.drawImage(img, 0, 0, w, h);
        const imageData = elements.processCtx.getImageData(0, 0, w, h);
        return {
            width: w,
            height: h,
            data: imageData.data
        };
    });

    // Resize display canvas to match new aspect ratio
    handleResize();
}

// --- Animation Loop ---

function togglePlay() {
    if (state.images.length < 2 && !state.isPlaying) return; // Need at least 2 images for transition or just play static?
    // Actually if only 1 image, 'play' does nothing or loops same image.
    
    state.isPlaying = !state.isPlaying;
    elements.playBtn.innerText = state.isPlaying ? "Pause" : "Play";
    
    if (state.isPlaying) {
        lastTime = performance.now();
        state.reqId = requestAnimationFrame(animate);
    } else {
        cancelAnimationFrame(state.reqId);
    }
}

function stopAnimation() {
    state.isPlaying = false;
    cancelAnimationFrame(state.reqId);
    elements.playBtn.innerText = "Play";
}

let lastTime = 0;

function animate(timestamp) {
    if (!state.isPlaying) return;
    
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    
    // Update logic
    // Speed 1.0 = 1 full transition in ~2 seconds?
    // Let's say speed 1.0 => 0.5 units per second
    const speedFactor = 0.5 * state.speed;
    
    state.t += speedFactor * dt;
    
    if (state.t >= 1.0) {
        state.t %= 1.0;
        state.currentImageIndex = state.nextImageIndex;
        state.nextImageIndex = (state.currentImageIndex + 1) % state.images.length;
    }
    
    renderFrame();
    state.reqId = requestAnimationFrame(animate);
}

// --- Rendering ---

function pseudoRandom(x, y) {
    return ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;
}

function renderFrame() {
    if (state.images.length === 0) return;

    const img1 = state.images[state.currentImageIndex];
    const img2 = state.images[state.nextImageIndex]; 
    
    const w = img1.width;
    const h = img1.height;
    
    // Display Canvas Setup
    const dCtx = elements.displayCtx;
    const dW = elements.displayCanvas.width;
    const dH = elements.displayCanvas.height;
    
    // Theme Colors
    const bgColor = state.inverted ? '#ffffff' : '#000000';
    const defaultColor = state.inverted ? '#000000' : '#ffffff'; 

    // Clear background
    dCtx.fillStyle = bgColor;
    dCtx.fillRect(0, 0, dW, dH);
    
    // Calculate Cell Size
    const cellW = dW / w;
    const cellH = dH / h;
    const fontSize = cellH; 
    
    dCtx.font = `${fontSize}px 'Fira Code', monospace`;
    dCtx.textBaseline = 'top';

    // Optimization: renderLoop
    const contrast = state.contrast;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            
            // Calculate Blend Factor (alpha) based on transition type
            let alpha = 0; // 0 = img1, 1 = img2
            
            switch (state.transitionType) {
                case 'fade':
                    alpha = state.t;
                    break;
                    
                case 'wipe':
                    // Scan from left to right with soft edge
                    // Limit goes from -0.2 to 1.2 to fully clear
                    const limit = state.t * 1.4 - 0.2;
                    const v = x / w;
                    // Smoothstep manually: clamp((x - edge0) / (edge1 - edge0), 0, 1)
                    // We want alpha=1 when v < limit.
                    // Actually, let's say left side is NEW image (alpha=1).
                    // So if x/w < limit -> 1.
                    // Soft edge:
                    alpha = 1.0 - Math.min(Math.max((v - limit) / 0.2, 0), 1);
                    break;
                    
                case 'dissolve':
                    const noise = pseudoRandom(x, y);
                    // Soft dissolve
                    // if t > noise, switch.
                    // blend around threshold
                    const threshold = state.t;
                    alpha = Math.min(Math.max((threshold - noise) / 0.1 + 0.5, 0), 1);
                    break;
                
                case 'venetian':
                    // Horizontal blinds
                    const bands = 10;
                    const bandH = h / bands;
                    const bandY = y % bandH;
                    const bandLimit = state.t * bandH;
                    // Grow from 0 height to bandH height
                    if (bandY < bandLimit) alpha = 1;
                    else alpha = 0;
                    // Maybe blend edge
                    break;
                    
                case 'flash':
                    // This is handled differently. We blend normally then flash white.
                    alpha = state.t; // Base fade
                    // But we modify the final color later.
                    break;
                    
                default:
                    alpha = state.t;
            }
            
            // LERP
            // Get pixels
            const r1 = img1.data[i];
            const g1 = img1.data[i+1];
            const b1 = img1.data[i+2];
            
            const r2 = img2.data[i];
            const g2 = img2.data[i+1];
            const b2 = img2.data[i+2];
            
            let r = r1 + (r2 - r1) * alpha;
            let g = g1 + (g2 - g1) * alpha;
            let b = b1 + (b2 - b1) * alpha;

            // Handle "Flash" overexposure
            if (state.transitionType === 'flash') {
                // Peak at 0.5
                const flash = Math.max(0, 1 - Math.abs(state.t - 0.5) * 4); // sharp peak
                if (flash > 0) {
                    const flashColor = 255;
                    r = r + (flashColor - r) * flash;
                    g = g + (flashColor - g) * flash;
                    b = b + (flashColor - b) * flash;
                }
            }
            
            // Contrast
            if (contrast !== 1.0) {
                r = factor * (r - 128) + 128;
                g = factor * (g - 128) + 128;
                b = factor * (b - 128) + 128;
            }
            
            // Clamp
            r = r < 0 ? 0 : r > 255 ? 255 : r;
            g = g < 0 ? 0 : g > 255 ? 255 : g;
            b = b < 0 ? 0 : b > 255 ? 255 : b;
            
            // Luminance
            const lum = (0.299 * r + 0.587 * g + 0.114 * b);
            
            // Char mapping
            let charIdx;
            if (state.inverted) {
                 charIdx = Math.floor(((255 - lum) / 255) * (revDensity.length - 1));
            } else {
                 charIdx = Math.floor((lum / 255) * (revDensity.length - 1));
            }
            
            const char = revDensity[charIdx];
            
            // Draw
            if (state.colored) {
                dCtx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
            } else {
                dCtx.fillStyle = defaultColor;
            }
            
            dCtx.fillText(char, x * cellW, y * cellH, cellW);
        }
    }
}

// --- GIF Recording ---

async function startRecording() {
    if (state.images.length === 0 || state.isRecording) return;
    
    stopAnimation();
    state.isRecording = true;
    elements.recordingStatus.style.display = 'block';
    elements.recProgress.innerText = '0%';
    elements.recordBtn.disabled = true;
    
    // Get worker blob
    const workerBlob = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js')
        .then(r => r.blob())
        .then(blob => URL.createObjectURL(blob));
        
    const gif = new GIF({
        workers: 2,
        quality: 10,
        workerScript: workerBlob,
        width: elements.displayCanvas.width,
        height: elements.displayCanvas.height
    });
    
    // Simulate animation loop
    const totalFrames = state.images.length * 30; // e.g., 30 frames per transition
    // Depends on speed. Let's fix 20 frames per image transition for GIF
    const framesPerTransition = 20;
    const step = 1.0 / framesPerTransition;
    
    // We need to loop through all transitions
    // 0->1, 1->2, ..., N->0
    
    state.currentImageIndex = 0;
    state.nextImageIndex = (state.images.length > 1) ? 1 : 0;
    state.t = 0;
    
    let frameCount = 0;
    const totalSteps = state.images.length * framesPerTransition;

    function captureStep() {
        if (!state.isRecording) return; // Cancelled
        
        renderFrame();
        gif.addFrame(elements.displayCanvas, {copy: true, delay: 50}); // 50ms = 20fps
        
        // Advance
        state.t += step;
        if (state.t >= 1.0) {
            state.t = 0;
            state.currentImageIndex = state.nextImageIndex;
            state.nextImageIndex = (state.currentImageIndex + 1) % state.images.length;
        }
        
        frameCount++;
        const pct = Math.round((frameCount / totalSteps) * 100);
        elements.recProgress.innerText = `${pct}%`;
        
        if (frameCount < totalSteps) {
            // Use setTimeout to allow UI to breathe
            setTimeout(captureStep, 0);
        } else {
            finishRecording(gif);
        }
    }
    
    captureStep();
}

function finishRecording(gif) {
    elements.recProgress.innerText = "Rendering...";
    gif.on('finished', (blob) => {
        window.open(URL.createObjectURL(blob));
        state.isRecording = false;
        elements.recordingStatus.style.display = 'none';
        elements.recordBtn.disabled = false;
    });
    gif.render();
}


// Start
init();
