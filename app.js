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
    transitionDurRange: document.getElementById('transitionDurRange'),
    transitionDurVal: document.getElementById('transitionDurVal'),
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
    processCtx: document.getElementById('processCanvas').getContext('2d', { willReadFrequently: true }),
    
    // Timeline Editor Elements
    timelineTrack: document.getElementById('timelineTrack'),
    timelineScrubber: document.getElementById('timelineScrubber'),
    timelineZoom: document.getElementById('timelineZoom'),
    
    // Toolbar Elements
    addSlideBtn: document.getElementById('addSlideBtn'),
    clipSettings: document.getElementById('clipSettings'),
    slideDuration: document.getElementById('slideDuration'),
    slideDurationVal: document.getElementById('slideDurationVal'),
    deleteSlideBtn: document.getElementById('deleteSlideBtn'),
};

// Application State
let state = {
    slides: [], // { id, img, duration }
    images: [], // { data: Uint8ClampedArray, width, height }
    
    // Grid dimensions
    gridW: 0,
    gridH: 0,
    
    // Animation
    currentImageIndex: 0,
    nextImageIndex: 0,
    t: 0,              // 0-1 progress through current slide (hold + transition)
    phase: 'hold',     // 'hold' or 'transition'
    phaseT: 0,         // 0-1 progress within current phase
    isPlaying: false,
    isRecording: false,
    reqId: null,
    
    // Settings
    speed: 1.0,     
    resolution: 80, 
    contrast: 1.0,
    colored: true,
    inverted: true,
    aspectRatio: 1.0, 
    transitionType: 'fade',
    transitionDuration: 0.5, // seconds for transition between images
    
    // Editor State
    zoom: 1.0,
    selectedSlideIndex: 0
};

// --- Initialization & Event Listeners ---

function init() {
    window.addEventListener('resize', handleResize);
    elements.fileInput.addEventListener('change', handleFileUpload);
    elements.playBtn.addEventListener('click', togglePlay);
    elements.recordBtn.addEventListener('click', startRecording);
    if (elements.addSlideBtn) elements.addSlideBtn.addEventListener('click', () => elements.fileInput.click()); 
    
    elements.transitionSelect.addEventListener('change', (e) => {
        state.transitionType = e.target.value;
    });

    elements.transitionDurRange.addEventListener('input', (e) => {
        state.transitionDuration = parseFloat(e.target.value);
        elements.transitionDurVal.innerText = state.transitionDuration.toFixed(1) + 's';
    });

    elements.speedRange.addEventListener('input', (e) => {
        state.speed = parseFloat(e.target.value);
        elements.speedVal.innerText = state.speed.toFixed(1) + 'x';
    });
    
    elements.resolutionRange.addEventListener('input', (e) => {
        state.resolution = parseInt(e.target.value);
        elements.resVal.innerText = state.resolution + ' chars';
        prepareImages(); 
    });
    
    elements.contrastRange.addEventListener('input', (e) => {
        state.contrast = parseFloat(e.target.value);
        elements.contrastVal.innerText = state.contrast;
        if (!state.isPlaying) renderFrame(); 
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
        if (!state.isPlaying) {
            if (state.images.length === 0) {
                renderEmptyState();
            } else {
                renderFrame();
            }
        }
    });

    // Editor Logic
    if (elements.slideDuration) {
        elements.slideDuration.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            elements.slideDurationVal.innerText = val.toFixed(1) + 's';
            
            if (state.slides[state.selectedSlideIndex]) {
                state.slides[state.selectedSlideIndex].duration = val;
                renderTimeline(); // Re-render track to show new widths
            }
        });
    }

    if (elements.deleteSlideBtn) {
        elements.deleteSlideBtn.addEventListener('click', () => {
            deleteSlide(state.selectedSlideIndex);
        });
    }

    if (elements.timelineZoom) {
        elements.timelineZoom.addEventListener('input', (e) => {
            state.zoom = parseFloat(e.target.value);
            renderTimeline();
        });
    }

    if (elements.timelineScrubber) {
        elements.timelineScrubber.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (state.isPlaying) stopAnimation();
            
            // Convert scrubber 0-1000 to total time (hold + transition for each slide)
            const transDur = state.transitionDuration;
            const totalDuration = state.slides.reduce((acc, s) => acc + (s.duration || 1.0) + transDur, 0);
            if (totalDuration === 0) return;
            
            const currentTotalProgress = (val / 1000) * totalDuration;
            
            // Find slide and phase
            let timeAccum = 0;
            let foundIdx = 0;
            let localT = 0;
            
            for (let i = 0; i < state.slides.length; i++) {
                const holdDur = state.slides[i].duration || 1.0;
                const slideTotalDur = holdDur + transDur;
                if (currentTotalProgress <= timeAccum + slideTotalDur) {
                    foundIdx = i;
                    localT = (currentTotalProgress - timeAccum) / slideTotalDur;
                    break;
                }
                timeAccum += slideTotalDur;
            }
            
            if (val === 1000) {
                foundIdx = 0;
                localT = 0;
            }
            
            state.currentImageIndex = foundIdx;
            state.nextImageIndex = (foundIdx + 1) % state.slides.length;
            state.t = localT;
            
            // Determine phase and phaseT
            const holdDur = state.slides[foundIdx].duration || 1.0;
            const holdRatio = holdDur / (holdDur + transDur);
            if (state.t < holdRatio) {
                state.phase = 'hold';
                state.phaseT = state.t / holdRatio;
            } else {
                state.phase = 'transition';
                state.phaseT = (state.t - holdRatio) / (1 - holdRatio);
            }
            
            // Select clip corresponding to scrubber position if user scrubs
            selectClip(foundIdx);
            
            renderFrame();
        });
    }
    
    handleResize();
    renderEmptyState();
}

function renderEmptyState() {
    const dCtx = elements.displayCtx;
    const dW = elements.displayCanvas.width;
    const dH = elements.displayCanvas.height;
    
    const bgColor = state.inverted ? '#f0f0f0' : '#050505';
    const textColor = state.inverted ? 'rgba(0,0,0,0.25)' : 'rgba(51,255,51,0.35)';
    
    dCtx.fillStyle = bgColor;
    dCtx.fillRect(0, 0, dW, dH);
    
    // Draw centered "Flux-ASCII" title
    const fontSize = Math.min(dW / 6, dH / 4, 80);
    dCtx.font = `bold ${fontSize}px 'Fira Code', monospace`;
    dCtx.fillStyle = textColor;
    dCtx.textAlign = 'center';
    dCtx.textBaseline = 'middle';
    dCtx.fillText('Flux-ASCII', dW / 2, dH / 2);
}

function finishLoading() {
    if (state.slides.length > 0) {
        const first = state.slides[0].img;
        state.aspectRatio = first.width / first.height;
        elements.fileCount.innerText = `${state.slides.length} images loaded`;
        elements.recordBtn.disabled = false;
        
        prepareImages();
        renderTimeline();
        
        state.currentImageIndex = 0;
        state.nextImageIndex = (state.slides.length > 1) ? 1 : 0;
        state.t = 0;
        
        selectClip(0);
        renderFrame();
    }
}

function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

function handleResize() {
    const rect = elements.container.getBoundingClientRect();
    const containerW = rect.width; 
    const containerH = rect.height;
    
    if (state.images.length === 0) {
        // Make initial canvas square
        const size = Math.min(containerW, containerH);
        elements.displayCanvas.width = size;
        elements.displayCanvas.height = size;
        renderEmptyState();
        return;
    }

    const targetAspect = (state.gridW * 0.6) / state.gridH;

    let canvasW, canvasH;

    if (containerW / containerH > targetAspect) {
        canvasH = containerH;
        canvasW = containerH * targetAspect;
    } else {
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

    stopAnimation();
    state.isPlaying = false;
    elements.playBtn.innerText = "Play";
    elements.recordBtn.disabled = true;
    
    elements.fileCount.innerText = "Loading...";
    
    // Add to existing? "Video Editor" implies usually adding, but previous behavior was replace.
    // User requested "Allow showing uploaded images" previously which we did.
    // Let's stick to "Replace" if using the Main Upload, but "Add" if using timeline "+" button.
    // But since I bound the "+" button to the same input, let's distinguish?
    // Actually, simple editor: Append if we have existing slides?
    // Let's make it APPEND by default now, as that's more editor-like.
    
    // state.slides = []; // Commented out to support append
    if (state.slides.length === 0) state.slides = [];
    
    files.sort((a, b) => a.name.localeCompare(b.name));

    try {
        const newSlides = [];
        for (const file of files) {
            const img = await loadImage(file);
            newSlides.push({
                id: Math.random().toString(36).substr(2, 9),
                img: img,
                duration: 1.0
            });
        }
        
        state.slides = state.slides.concat(newSlides);
        
        finishLoading(); // Re-runs prepareImages
    } catch (err) {
        console.error(err);
        elements.fileCount.innerText = "Error loading images";
    }
    
    // Reset input
    elements.fileInput.value = '';
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

// --- Timeline Editor Logic ---

function renderTimeline() {
    if (!elements.timelineTrack) return;
    elements.timelineTrack.innerHTML = '';
    
    state.slides.forEach((slide, idx) => {
        const clip = document.createElement('div');
        clip.className = 'track-clip';
        if (idx === state.selectedSlideIndex) clip.classList.add('selected');
        
        // Width based on duration * zoom
        const width = (slide.duration || 1.0) * 100 * state.zoom;
        clip.style.width = `${width}px`;
        clip.dataset.index = idx;
        clip.draggable = true;
        
        const thumb = document.createElement('img');
        thumb.src = slide.img.src;
        thumb.className = 'clip-thumb';
        
        const label = document.createElement('div');
        label.className = 'clip-label';
        label.innerText = (slide.duration || 1.0).toFixed(1) + 's';
        
        clip.appendChild(thumb);
        clip.appendChild(label);
        
        // Events
        clip.addEventListener('click', (e) => {
            e.stopPropagation();
            selectClip(idx);
            // Jump preview to start of this clip
            jumpToClip(idx);
        });
        
        clip.addEventListener('dragstart', handleDragStart);
        clip.addEventListener('dragover', handleDragOver);
        clip.addEventListener('drop', handleDrop);
        
        elements.timelineTrack.appendChild(clip);
    });
}

function selectClip(idx) {
    state.selectedSlideIndex = idx;
    
    // Update UI highlights
    const clips = document.querySelectorAll('.track-clip');
    clips.forEach(c => c.classList.remove('selected'));
    if (clips[idx]) clips[idx].classList.add('selected');
    
    // Enable Toolbar if we have slides
    if (elements.clipSettings && state.slides.length > 0) {
        elements.clipSettings.style.opacity = '1';
        elements.clipSettings.style.pointerEvents = 'auto';
    }
    
    const slide = state.slides[idx];
    if (slide) {
        if (elements.slideDuration) elements.slideDuration.value = slide.duration || 1.0;
        if (elements.slideDurationVal) elements.slideDurationVal.innerText = (slide.duration || 1.0).toFixed(1) + 's';
    }
}

function deleteSlide(idx) {
    if (state.slides.length === 0) return;
    
    state.slides.splice(idx, 1);
    
    // Handle empty state
    if (state.slides.length === 0) {
        state.images = [];
        state.selectedSlideIndex = -1;
        state.currentImageIndex = 0;
        state.nextImageIndex = 0;
        
        // Show empty state background
        renderEmptyState();
        
        // Disable toolbar
        if (elements.clipSettings) {
            elements.clipSettings.style.opacity = '0.5';
            elements.clipSettings.style.pointerEvents = 'none';
        }
        
        elements.fileCount.innerText = '0 files loaded';
        elements.recordBtn.disabled = true;
        renderTimeline();
        return;
    }
    
    if (state.selectedSlideIndex >= state.slides.length) {
        state.selectedSlideIndex = state.slides.length - 1;
    }
    
    // Fix current playing index if needed
    if (state.currentImageIndex >= state.slides.length) {
        state.currentImageIndex = 0;
    }
    
    prepareImages();
    renderTimeline();
    selectClip(state.selectedSlideIndex);
    jumpToClip(state.selectedSlideIndex);
}

function jumpToClip(idx) {
    stopAnimation();
    state.currentImageIndex = idx;
    state.nextImageIndex = (idx + 1) % state.slides.length;
    state.t = 0;
    state.phase = 'hold';
    state.phaseT = 0;
    renderFrame();
    updateScrubberFromState();
}

// Drag & Drop
let draggedItemIndex = null;

function handleDragStart(e) {
    draggedItemIndex = parseInt(this.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    e.stopPropagation(); 
    const targetIdx = parseInt(this.dataset.index);
    if (draggedItemIndex !== null && draggedItemIndex !== targetIdx) {
        const item = state.slides.splice(draggedItemIndex, 1)[0];
        state.slides.splice(targetIdx, 0, item);
        
        prepareImages();
        renderTimeline();
        
        // Keep selection on moved item
        selectClip(targetIdx);
        jumpToClip(targetIdx);
    }
    return false;
}

function updateScrubberFromState() {
    if (state.slides.length < 1) return;
    if (!elements.timelineScrubber) return;
    
    const transDur = state.transitionDuration;
    const totalDuration = state.slides.reduce((acc, s) => acc + (s.duration || 1.0) + transDur, 0);
    
    let timeAccum = 0;
    for (let i = 0; i < state.currentImageIndex; i++) {
        timeAccum += (state.slides[i].duration || 1.0) + transDur;
    }
    
    const holdDur = state.slides[state.currentImageIndex].duration || 1.0;
    const slideTotalDur = holdDur + transDur;
    timeAccum += state.t * slideTotalDur;
    
    const totalProgress = timeAccum / totalDuration;
    
    elements.timelineScrubber.value = Math.round(totalProgress * 1000);
}

// --- Processing ---

function prepareImages() {
    if (state.slides.length === 0) return;

    const charAspect = 0.6; 
    const w = state.resolution;
    const h = Math.floor(w / state.aspectRatio * charAspect);

    state.gridW = w;
    state.gridH = h;
    
    elements.processCanvas.width = w;
    elements.processCanvas.height = h;

    state.images = state.slides.map(slide => {
        elements.processCtx.clearRect(0, 0, w, h);
        elements.processCtx.drawImage(slide.img, 0, 0, w, h);
        const imageData = elements.processCtx.getImageData(0, 0, w, h);
        return {
            width: w,
            height: h,
            data: imageData.data
        };
    });

    handleResize();
}

// --- Animation Loop ---

function togglePlay() {
    if (state.slides.length < 2 && !state.isPlaying) return; 
    
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
    
    const dt = (timestamp - lastTime) / 1000 * state.speed;
    lastTime = timestamp;
    
    const holdDur = state.slides[state.currentImageIndex].duration || 1.0;
    const transDur = state.transitionDuration;
    const totalDur = holdDur + transDur;
    
    // Advance time
    state.t += dt / totalDur;
    
    if (state.t >= 1.0) {
        state.t %= 1.0;
        state.currentImageIndex = state.nextImageIndex;
        state.nextImageIndex = (state.currentImageIndex + 1) % state.slides.length;
        state.phase = 'hold';
        state.phaseT = 0;
        
        selectClip(state.currentImageIndex);
    }
    
    // Determine phase and phaseT
    const holdRatio = holdDur / totalDur;
    if (state.t < holdRatio) {
        state.phase = 'hold';
        state.phaseT = state.t / holdRatio;
    } else {
        state.phase = 'transition';
        state.phaseT = (state.t - holdRatio) / (1 - holdRatio);
    }
    
    renderFrame();
    updateScrubberFromState();
    
    state.reqId = requestAnimationFrame(animate);
}

// --- Rendering ---
// (Unchanged from previous simplified version, omitting for brevity in thought process but including in write)

function pseudoRandom(x, y) {
    return ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;
}

function renderFrame() {
    if (state.images.length === 0) return;

    const img1 = state.images[state.currentImageIndex];
    const img2 = state.images[state.nextImageIndex]; 
    
    const w = img1.width;
    const h = img1.height;
    
    const dCtx = elements.displayCtx;
    const dW = elements.displayCanvas.width;
    const dH = elements.displayCanvas.height;
    
    const bgColor = state.inverted ? '#ffffff' : '#000000';
    const defaultColor = state.inverted ? '#000000' : '#ffffff'; 

    dCtx.fillStyle = bgColor;
    dCtx.fillRect(0, 0, dW, dH);
    
    const cellW = dW / w;
    const cellH = dH / h;
    const fontSize = cellH; 
    
    dCtx.font = `${fontSize}px 'Fira Code', monospace`;
    dCtx.textBaseline = 'top';

    const contrast = state.contrast;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    
    // During 'hold' phase, show static image (alpha=0)
    // During 'transition' phase, blend based on phaseT
    const transT = state.phase === 'hold' ? 0 : state.phaseT;
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            
            let alpha = 0; 
            
            if (state.phase === 'hold') {
                alpha = 0; // Show only img1
            } else {
                switch (state.transitionType) {
                    case 'fade':
                        alpha = transT;
                        break;
                        
                    case 'wipe':
                        const limit = transT * 1.4 - 0.2;
                        const v = x / w;
                        alpha = 1.0 - Math.min(Math.max((v - limit) / 0.2, 0), 1);
                        break;
                        
                    case 'dissolve':
                        const noise = pseudoRandom(x, y);
                        const threshold = transT;
                        alpha = Math.min(Math.max((threshold - noise) / 0.1 + 0.5, 0), 1);
                        break;
                    
                    case 'venetian':
                        const bands = 10;
                        const bandH = h / bands;
                        const bandY = y % bandH;
                        const bandLimit = transT * bandH;
                        if (bandY < bandLimit) alpha = 1;
                        else alpha = 0;
                        break;
                        
                    case 'flash':
                        alpha = transT;
                        break;
                        
                    default:
                        alpha = transT;
                }
            }
            
            const r1 = img1.data[i];
            const g1 = img1.data[i+1];
            const b1 = img1.data[i+2];
            
            const r2 = img2.data[i];
            const g2 = img2.data[i+1];
            const b2 = img2.data[i+2];
            
            let r = r1 + (r2 - r1) * alpha;
            let g = g1 + (g2 - g1) * alpha;
            let b = b1 + (b2 - b1) * alpha;

            if (state.phase === 'transition' && state.transitionType === 'flash') {
                const flash = Math.max(0, 1 - Math.abs(transT - 0.5) * 4);
                if (flash > 0) {
                    const flashColor = 255;
                    r = r + (flashColor - r) * flash;
                    g = g + (flashColor - g) * flash;
                    b = b + (flashColor - b) * flash;
                }
            }
            
            if (contrast !== 1.0) {
                r = factor * (r - 128) + 128;
                g = factor * (g - 128) + 128;
                b = factor * (b - 128) + 128;
            }
            
            r = r < 0 ? 0 : r > 255 ? 255 : r;
            g = g < 0 ? 0 : g > 255 ? 255 : g;
            b = b < 0 ? 0 : b > 255 ? 255 : b;
            
            const lum = (0.299 * r + 0.587 * g + 0.114 * b);
            
            let charIdx;
            if (state.inverted) {
                 charIdx = Math.floor(((255 - lum) / 255) * (revDensity.length - 1));
            } else {
                 charIdx = Math.floor((lum / 255) * (revDensity.length - 1));
            }
            
            const char = revDensity[charIdx];
            
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
    if (state.slides.length === 0 || state.isRecording) return;
    
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
        height: elements.displayCanvas.height,
        repeat: 0 // 0 = loop forever
    });
    
    const gifFPS = 20; 
    const frameDelay = 1000 / gifFPS;
    const transDur = state.transitionDuration;
    
    let tasks = [];
    
    for (let i = 0; i < state.slides.length; i++) {
        const holdDur = state.slides[i].duration || 1.0;
        const totalSlideDur = holdDur + transDur;
        const seconds = totalSlideDur / state.speed;
        const frames = Math.max(2, Math.round(seconds * gifFPS));
        const holdRatio = holdDur / totalSlideDur;
        
        for (let f = 0; f < frames; f++) {
            const t = f / frames;
            let phase, phaseT;
            if (t < holdRatio) {
                phase = 'hold';
                phaseT = t / holdRatio;
            } else {
                phase = 'transition';
                phaseT = (t - holdRatio) / (1 - holdRatio);
            }
            tasks.push({
                idx: i,
                t: t,
                phase: phase,
                phaseT: phaseT
            });
        }
    }
    
    let taskIndex = 0;
    const totalTasks = tasks.length;

    function captureStep() {
        if (!state.isRecording) return;
        
        const task = tasks[taskIndex];
        
        state.currentImageIndex = task.idx;
        state.nextImageIndex = (task.idx + 1) % state.slides.length;
        state.t = task.t;
        state.phase = task.phase;
        state.phaseT = task.phaseT;
        
        renderFrame();
        gif.addFrame(elements.displayCanvas, {copy: true, delay: frameDelay});
        
        taskIndex++;
        const pct = Math.round((taskIndex / totalTasks) * 100);
        elements.recProgress.innerText = `${pct}%`;
        
        if (taskIndex < totalTasks) {
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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'flux-ascii-loop.gif';
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);

        state.isRecording = false;
        elements.recordingStatus.style.display = 'none';
        elements.recordBtn.disabled = false;
        
        togglePlay();
    });
    gif.render();
}

// Start
init();
