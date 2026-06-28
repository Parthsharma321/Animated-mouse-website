// Application Config & State - Razer Sentinels Edition
const CONFIG = {
    frameCount: 192,
    imagePrefix: 'frame_',
    imageExt: '.jpg',
    defaultInertia: 0.08,
    // Ranges (0.0 to 1.0) of scroll progress where overlay texts are visible
    overlayRanges: [
        { id: 'hero-text-1', start: 0.00, end: 0.20 },
        { id: 'hero-text-2', start: 0.26, end: 0.46 },
        { id: 'hero-text-3', start: 0.52, end: 0.72 },
        { id: 'hero-text-4', start: 0.78, end: 0.96 }
    ]
};

const state = {
    images: [],
    loadedCount: 0,
    currentFrame: 0,
    targetFrame: 0,
    inertia: CONFIG.defaultInertia,
    isAutoPlaying: false,
    autoPlaySpeed: 1.0,
    vignetteEnabled: true,
    imageSmoothing: true,
    canvasWidth: 1920,
    canvasHeight: 1080
};

// DOM Elements
const canvas = document.getElementById('animation-canvas');
const ctx = canvas.getContext('2d');
const preloader = document.getElementById('preloader');
const progressFill = document.getElementById('progress-fill');
const percentageText = document.getElementById('loading-percentage');
const scrollCue = document.getElementById('scroll-prompt-indicator');
const vignetteOverlay = document.getElementById('vignette');

// Dashboard Elements
const dashboard = document.getElementById('dashboard');
const dbTrigger = document.getElementById('dashboard-trigger');
const dbClose = document.getElementById('close-dashboard');
const inertiaSlider = document.getElementById('inertia-slider');
const inertiaVal = document.getElementById('inertia-val');
const btnScroll = document.getElementById('mode-scroll');
const btnAuto = document.getElementById('mode-auto');
const speedGroup = document.getElementById('speed-group');
const speedSlider = document.getElementById('speed-slider');
const speedVal = document.getElementById('speed-val');
const vignetteToggle = document.getElementById('vignette-toggle');
const smoothingToggle = document.getElementById('smoothing-toggle');
const frameCounter = document.getElementById('frame-counter');

// 1. Asynchronous Image Preloading
function preloadImages() {
    return new Promise((resolve) => {
        for (let i = 0; i < CONFIG.frameCount; i++) {
            const img = new Image();
            const paddedIndex = i.toString().padStart(4, '0');
            img.src = `${CONFIG.imagePrefix}${paddedIndex}${CONFIG.imageExt}`;
            
            img.onload = () => {
                state.loadedCount++;
                updateLoadingProgress();
                if (state.loadedCount === CONFIG.frameCount) {
                    resolve();
                }
            };
            
            img.onerror = () => {
                console.error(`Failed to load frame: ${img.src}`);
                state.loadedCount++;
                updateLoadingProgress();
                if (state.loadedCount === CONFIG.frameCount) {
                    resolve();
                }
            };
            
            state.images.push(img);
        }
    });
}

function updateLoadingProgress() {
    const percent = Math.round((state.loadedCount / CONFIG.frameCount) * 100);
    progressFill.style.width = `${percent}%`;
    percentageText.textContent = `${percent}%`;
}

// 2. Canvas Resizing & Scaling (Cover aspect ratio fitting)
function resizeCanvas() {
    const parent = canvas.parentElement;
    if (!parent) return;
    
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = state.imageSmoothing;
    
    drawFrame(state.currentFrame);
}

function drawFrame(frameIndex) {
    const roundedFrame = Math.round(frameIndex);
    const img = state.images[roundedFrame];
    
    if (!img || !img.complete) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const imgWidth = img.width || state.canvasWidth;
    const imgHeight = img.height || state.canvasHeight;
    const imgRatio = imgWidth / imgHeight;
    
    const parent = canvas.parentElement;
    if (!parent) return;
    
    const viewportWidth = parent.clientWidth;
    const viewportHeight = parent.clientHeight;
    const viewportRatio = viewportWidth / viewportHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    
    if (viewportRatio > imgRatio) {
        drawWidth = viewportWidth;
        drawHeight = viewportWidth / imgRatio;
        offsetX = 0;
        offsetY = (viewportHeight - drawHeight) / 2;
    } else {
        drawWidth = viewportHeight * imgRatio;
        drawHeight = viewportHeight;
        offsetX = (viewportWidth - drawWidth) / 2;
        offsetY = 0;
    }
    
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

// 3. Scroll Calculations mapping to Frames and Text Overlays
function updateTargetFrame() {
    if (state.isAutoPlaying) return;
    
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // The sticky intro scroll boundary: height is 400vh, viewport is 100vh.
    // So the scroll boundary limit is 300vh (3 * window.innerHeight).
    const scrollLimit = window.innerHeight * 3;
    
    // Calculate scroll percentage of this section
    const progress = Math.min(1, Math.max(0, scrollTop / scrollLimit));
    
    state.targetFrame = progress * (CONFIG.frameCount - 1);
    
    // Hide scroll cue once user starts scrolling
    if (scrollTop > 20) {
        scrollCue.classList.add('fade-out');
    } else {
        scrollCue.classList.remove('fade-out');
    }
    
    updateTextOverlays(progress);
}

function updateTextOverlays(progress) {
    CONFIG.overlayRanges.forEach(range => {
        const el = document.getElementById(range.id);
        if (el) {
            if (progress >= range.start && progress <= range.end) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        }
    });
}

// Animation and Inertia Loop
function animate() {
    const scrollLimit = window.innerHeight * 3;
    
    if (state.isAutoPlaying) {
        let currentScroll = window.scrollY;
        const step = state.autoPlaySpeed * 1.5;
        let targetScroll = currentScroll + step;
        
        // Wrap scroll animation within the boundaries of the sticky intro showcase
        if (targetScroll >= scrollLimit) {
            targetScroll = 0;
        }
        
        window.scrollTo(0, targetScroll);
        
        const progress = targetScroll / scrollLimit;
        state.targetFrame = progress * (CONFIG.frameCount - 1);
        updateTextOverlays(progress);
    }
    
    // Apply interpolation damping
    const diff = state.targetFrame - state.currentFrame;
    
    if (Math.abs(diff) > 0.001) {
        state.currentFrame += diff * state.inertia;
        state.currentFrame = Math.max(0, Math.min(CONFIG.frameCount - 1, state.currentFrame));
        drawFrame(state.currentFrame);
        updateUI();
    } else if (state.currentFrame !== state.targetFrame) {
        state.currentFrame = state.targetFrame;
        drawFrame(state.currentFrame);
        updateUI();
    }
    
    requestAnimationFrame(animate);
}

function updateUI() {
    const curFrameRounded = Math.round(state.currentFrame);
    frameCounter.textContent = `${curFrameRounded.toString().padStart(4, '0')} / ${(CONFIG.frameCount - 1).toString().padStart(4, '0')}`;
}

// 4. Interactive Control Event Bindings
function initControls() {
    // Accordion FAQ triggers
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const isActive = item.classList.contains('active');
            
            // Close other accordion items to keep things tidy
            document.querySelectorAll('.accordion-item').forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // Settings panel toggles
    dbTrigger.addEventListener('click', () => dashboard.classList.add('open'));
    dbClose.addEventListener('click', () => dashboard.classList.remove('open'));
    
    document.addEventListener('click', (e) => {
        if (!dashboard.contains(e.target) && !dbTrigger.contains(e.target) && dashboard.classList.contains('open')) {
            dashboard.classList.remove('open');
        }
    });
    
    // Inertia slider
    inertiaSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.inertia = val;
        inertiaVal.textContent = val.toFixed(2);
    });
    
    // Manual scroll
    btnScroll.addEventListener('click', () => {
        state.isAutoPlaying = false;
        btnScroll.classList.add('active');
        btnAuto.classList.remove('active');
        speedGroup.style.display = 'none';
    });
    
    // Auto demo loop
    btnAuto.addEventListener('click', () => {
        state.isAutoPlaying = true;
        btnAuto.classList.add('active');
        btnScroll.classList.remove('active');
        speedGroup.style.display = 'flex';
    });
    
    // Auto speed
    speedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        state.autoPlaySpeed = val;
        speedVal.textContent = `${val.toFixed(1)}x`;
    });
    
    // Vignette toggle
    vignetteToggle.addEventListener('change', (e) => {
        state.vignetteEnabled = e.target.checked;
        if (state.vignetteEnabled) {
            vignetteOverlay.classList.remove('hidden');
        } else {
            vignetteOverlay.classList.add('hidden');
        }
    });
    
    // Image smoothing toggle
    smoothingToggle.addEventListener('change', (e) => {
        state.imageSmoothing = e.target.checked;
        ctx.imageSmoothingEnabled = state.imageSmoothing;
        drawFrame(state.currentFrame);
    });
}

// 5. Initializer
async function init() {
    initControls();
    await preloadImages();
    preloader.classList.add('fade-out');
    resizeCanvas();
    
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', updateTargetFrame);
    
    // Trigger initial overlay checks
    updateTargetFrame();
    
    requestAnimationFrame(animate);
}

document.addEventListener('DOMContentLoaded', init);
