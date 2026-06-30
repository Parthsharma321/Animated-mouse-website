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
        const totalFrames = CONFIG.frameCount;
        const priorityFrames = [];
        
        // Priority frames: first 15 frames for immediate hero rendering
        for (let i = 0; i < 15; i++) {
            priorityFrames.push(i);
        }
        // Sample every 15th frame across the rest to give partial coverage during background load
        for (let i = 15; i < totalFrames; i += 15) {
            priorityFrames.push(i);
        }
        
        let priorityLoaded = 0;
        
        // Initialize state.images with empty image structures
        for (let i = 0; i < totalFrames; i++) {
            state.images.push(new Image());
        }
        
        function loadFrame(i, isPriority) {
            const img = state.images[i];
            const paddedIndex = i.toString().padStart(4, '0');
            img.src = `${CONFIG.imagePrefix}${paddedIndex}${CONFIG.imageExt}`;
            
            img.onload = () => {
                state.loadedCount++;
                if (isPriority) {
                    priorityLoaded++;
                    updateLoadingProgress(priorityLoaded, priorityFrames.length);
                    if (priorityLoaded === priorityFrames.length) {
                        resolve();
                        // Start downloading all other frames in the background
                        loadRemaining();
                    }
                }
            };
            
            img.onerror = () => {
                console.error(`Failed to load frame: ${img.src}`);
                state.loadedCount++;
                if (isPriority) {
                    priorityLoaded++;
                    updateLoadingProgress(priorityLoaded, priorityFrames.length);
                    if (priorityLoaded === priorityFrames.length) {
                        resolve();
                        loadRemaining();
                    }
                }
            };
        }
        
        // First load priority frames
        priorityFrames.forEach(idx => {
            loadFrame(idx, true);
        });
        
        // Load the remaining frames in the background
        function loadRemaining() {
            for (let i = 0; i < totalFrames; i++) {
                if (!priorityFrames.includes(i)) {
                    loadFrame(i, false);
                }
            }
        }
    });
}

function updateLoadingProgress(loaded, total) {
    const percent = Math.round((loaded / total) * 100);
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
    let img = state.images[roundedFrame];
    
    // Fallback to the closest loaded frame if target frame isn't loaded yet
    if (!img || !img.complete || img.naturalWidth === 0) {
        let closestFrame = -1;
        let minDistance = Infinity;
        for (let i = 0; i < CONFIG.frameCount; i++) {
            const tempImg = state.images[i];
            if (tempImg && tempImg.complete && tempImg.naturalWidth > 0) {
                const dist = Math.abs(i - roundedFrame);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestFrame = i;
                }
            }
        }
        if (closestFrame !== -1) {
            img = state.images[closestFrame];
        } else {
            return; // No frames loaded at all yet
        }
    }
    
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

// Interactive Click-and-Drag 3D Rotation
function initDragRotate() {
    let isDragging = false;
    let startX = 0;
    let startScroll = 0;
    const canvasContainer = canvas.parentElement; // sticky-viewport
    
    if (!canvasContainer) return;
    
    // Set style to show grab pointer
    canvasContainer.style.cursor = 'grab';
    
    function startDrag(e) {
        // Only trigger drag on main click, or touches
        if (e.button && e.button !== 0) return;
        isDragging = true;
        canvasContainer.style.cursor = 'grabbing';
        startX = e.clientX || e.touches[0].clientX;
        startScroll = window.scrollY || document.documentElement.scrollTop;
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        // Prevent default touch scrolling inside the canvas
        if (e.cancelable) e.preventDefault();
        
        const currentX = e.clientX || (e.touches && e.touches[0].clientX);
        if (currentX === undefined) return;
        
        const deltaX = currentX - startX;
        const viewportWidth = window.innerWidth;
        const scrollLimit = window.innerHeight * 3;
        
        // Drag sensitivity: 1 full screen width drag rotates through 85% of the frames
        const sensitivity = 0.85;
        const dragScrollDelta = (deltaX / viewportWidth) * scrollLimit * sensitivity;
        
        // Calculate new target scroll position (dragging right spins right)
        let targetScroll = startScroll - dragScrollDelta;
        targetScroll = Math.max(0, Math.min(scrollLimit, targetScroll));
        
        window.scrollTo(0, targetScroll);
    }
    
    function stopDrag() {
        if (!isDragging) return;
        isDragging = false;
        canvasContainer.style.cursor = 'grab';
    }
    
    canvasContainer.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag, { passive: false });
    window.addEventListener('mouseup', stopDrag);
    
    // Mobile Touch events
    canvasContainer.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('touchmove', drag, { passive: false });
    window.addEventListener('touchend', stopDrag);
}

// Dynamic RGB Accent Theme Picker
function initThemeCustomizer() {
    const themeDots = document.querySelectorAll('.theme-dot');
    const themeColors = {
        red: { color: '#ff003c', glow: 'rgba(255, 0, 60, 0.45)' },
        green: { color: '#4caf50', glow: 'rgba(76, 175, 80, 0.45)' },
        gold: { color: '#ffb300', glow: 'rgba(255, 179, 0, 0.45)' },
        purple: { color: '#e040fb', glow: 'rgba(224, 64, 251, 0.45)' }
    };

    themeDots.forEach(dot => {
        dot.addEventListener('click', () => {
            themeDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            
            const theme = dot.getAttribute('data-theme');
            const colors = themeColors[theme];
            
            document.documentElement.style.setProperty('--accent-color', colors.color);
            document.documentElement.style.setProperty('--accent-glow', colors.glow);
        });
    });
}

// Interactive Sliding Navigation Drawer Menu
function initOverlayMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const overlayMenu = document.getElementById('overlay-menu');
    const closeBtn = document.getElementById('overlay-menu-close');
    const menuLinks = document.querySelectorAll('.menu-link');
    
    if (!menuToggle || !overlayMenu) return;
    
    function openMenu() {
        overlayMenu.classList.add('open');
        menuToggle.classList.add('open');
    }
    
    function closeMenu() {
        overlayMenu.classList.remove('open');
        menuToggle.classList.remove('open');
    }
    
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (overlayMenu.classList.contains('open')) {
            closeMenu();
        } else {
            openMenu();
        }
    });
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMenu);
    }
    
    // Close menu when clicking outside of it
    document.addEventListener('click', (e) => {
        if (!overlayMenu.contains(e.target) && !menuToggle.contains(e.target) && overlayMenu.classList.contains('open')) {
            closeMenu();
        }
    });
    
    // Handle link clicking & smooth scroll
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            closeMenu();
            
            const targetId = link.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                const offset = 72; // var(--nav-height)
                const bodyRect = document.body.getBoundingClientRect().top;
                const elementRect = targetEl.getBoundingClientRect().top;
                const elementPosition = elementRect - bodyRect;
                const offsetPosition = elementPosition - offset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Components Explorer Tabs logic
function initComponentTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));
            
            tab.classList.add('active');
            const targetTab = tab.getAttribute('data-tab');
            const contentEl = document.getElementById(`tab-${targetTab}`);
            if (contentEl) {
                contentEl.classList.add('active');
            }
        });
    });
}

// DPI & Polling Rate Canvas Simulator
function initPollingSimulator() {
    const canvasSim = document.getElementById('sim-canvas');
    const sliderPolling = document.getElementById('sim-polling');
    const sliderDpi = document.getElementById('sim-dpi');
    const valPolling = document.getElementById('sim-polling-val');
    const valDpi = document.getElementById('sim-dpi-val');
    const valLatency = document.getElementById('sim-latency');
    const valReports = document.getElementById('sim-reports');
    
    if (!canvasSim) return;
    const ctxSim = canvasSim.getContext('2d');
    
    let pollingRate = 8000;
    let dpi = 1600;
    let mouseHistory = [];
    
    function resizeSimCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const width = canvasSim.parentElement.clientWidth;
        const height = canvasSim.parentElement.clientHeight;
        canvasSim.width = width * dpr;
        canvasSim.height = height * dpr;
        ctxSim.scale(dpr, dpr);
    }
    
    window.addEventListener('resize', resizeSimCanvas);
    resizeSimCanvas();
    
    sliderPolling.addEventListener('input', (e) => {
        pollingRate = parseInt(e.target.value);
        valPolling.textContent = `${pollingRate} Hz`;
        valReports.textContent = pollingRate.toLocaleString();
        const latency = (1000 / pollingRate).toFixed(3);
        valLatency.textContent = `${latency} ms`;
    });
    
    sliderDpi.addEventListener('input', (e) => {
        dpi = parseInt(e.target.value);
        valDpi.textContent = `${dpi} DPI`;
    });
    
    canvasSim.parentElement.addEventListener('mousemove', (e) => {
        const rect = canvasSim.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const time = performance.now();
        mouseHistory.push({ x, y, time });
        
        if (mouseHistory.length > 250) {
            mouseHistory.shift();
        }
    });
    
    canvasSim.parentElement.addEventListener('mouseleave', () => {
        mouseHistory = [];
    });
    
    function renderSim() {
        const dpr = window.devicePixelRatio || 1;
        ctxSim.clearRect(0, 0, canvasSim.width / dpr, canvasSim.height / dpr);
        
        // Clean history of items older than 800ms
        const now = performance.now();
        mouseHistory = mouseHistory.filter(pt => now - pt.time < 800);
        
        if (mouseHistory.length > 1) {
            const skipFactor = Math.max(1, Math.round(8000 / pollingRate));
            
            ctxSim.beginPath();
            ctxSim.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#ff003c';
            ctxSim.lineWidth = 3;
            ctxSim.lineCap = 'round';
            ctxSim.lineJoin = 'round';
            ctxSim.shadowBlur = 10;
            ctxSim.shadowColor = ctxSim.strokeStyle;
            
            let started = false;
            for (let i = 0; i < mouseHistory.length; i++) {
                if (i % skipFactor === 0 || i === mouseHistory.length - 1) {
                    const pt = mouseHistory[i];
                    if (!started) {
                        ctxSim.moveTo(pt.x, pt.y);
                        started = true;
                    } else {
                        ctxSim.lineTo(pt.x, pt.y);
                    }
                }
            }
            ctxSim.stroke();
            
            // Draw individual dots to show frequency gaps
            ctxSim.shadowBlur = 0;
            for (let i = 0; i < mouseHistory.length; i++) {
                if (i % skipFactor === 0 || i === mouseHistory.length - 1) {
                    const pt = mouseHistory[i];
                    ctxSim.beginPath();
                    ctxSim.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
                    ctxSim.fillStyle = '#ffffff';
                    ctxSim.fill();
                }
            }
        }
        
        requestAnimationFrame(renderSim);
    }
    
    renderSim();
}

// Balance Weight Scale Comparison simulator
function initWeightSimulator() {
    const scaleBtns = document.querySelectorAll('.scale-item-btn');
    const beam = document.getElementById('scale-beam');
    const rightName = document.getElementById('pan-right-name');
    const rightWeight = document.getElementById('pan-right-weight');
    const verdict = document.getElementById('scale-verdict');
    
    if (!beam) return;
    
    scaleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            scaleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const itemWeight = parseInt(btn.getAttribute('data-weight'));
            const itemName = btn.getAttribute('data-name');
            
            if (rightName) rightName.textContent = itemName;
            if (rightWeight) rightWeight.textContent = `${itemWeight}g`;
            
            const delta = itemWeight - 54;
            let angle = 0;
            if (delta > 0) {
                angle = Math.min(15, 2 + (delta * 0.4));
            } else if (delta < 0) {
                angle = Math.max(-15, -2 + (delta * 0.4));
            }
            
            beam.style.transform = `rotate(${angle}deg)`;
            
            if (verdict) {
                if (itemWeight > 54) {
                    const times = (itemWeight / 54).toFixed(1);
                    verdict.innerHTML = `Tactical Advantage: The **Viper V3 Pro (54g)** is <strong>${times}x lighter</strong> than the ${itemName} (${itemWeight}g), reducing wrist fatigue and speed drag.`;
                } else if (itemWeight < 54) {
                    verdict.innerHTML = `Durability Triumph: The **Viper V3 Pro (54g)** is only slightly heavier than the ${itemName} (${itemWeight}g), maintaining structural durability with no weight penalty.`;
                } else {
                    verdict.innerHTML = `Perfect parity: Both the Viper V3 Pro and the ${itemName} weigh exactly 54g.`;
                }
            }
        });
    });
    
    const initialBtn = document.querySelector('.scale-item-btn[data-weight="50"]');
    if (initialBtn) initialBtn.click();
}

// Sentinels Pro player configurations copier & theme changer
function initProCards() {
    const cards = document.querySelectorAll('.pro-card');
    const themeColors = {
        purple: { color: '#e040fb', glow: 'rgba(224, 64, 251, 0.45)' },
        green: { color: '#4caf50', glow: 'rgba(76, 175, 80, 0.45)' },
        gold: { color: '#ffb300', glow: 'rgba(255, 179, 0, 0.45)' }
    };
    
    cards.forEach(card => {
        const btn = card.querySelector('.btn-load-config');
        if (!btn) return;
        
        btn.addEventListener('click', () => {
            const player = card.getAttribute('data-player');
            const colorName = card.getAttribute('data-color');
            const colors = themeColors[colorName];
            
            if (colors) {
                document.documentElement.style.setProperty('--accent-color', colors.color);
                document.documentElement.style.setProperty('--accent-glow', colors.glow);
                
                const themeDots = document.querySelectorAll('.theme-dot');
                themeDots.forEach(dot => {
                    dot.classList.remove('active');
                    if (dot.getAttribute('data-theme') === (colorName === 'purple' ? 'purple' : colorName === 'green' ? 'green' : 'gold')) {
                        dot.classList.add('active');
                    }
                });
            }
            
            if (player === 'tenz') {
                state.inertia = 0.04;
                state.autoPlaySpeed = 1.8;
            } else if (player === 'zellsis') {
                state.inertia = 0.12;
                state.autoPlaySpeed = 1.0;
            } else if (player === 'johnqt') {
                state.inertia = 0.08;
                state.autoPlaySpeed = 1.4;
            }
            
            inertiaSlider.value = state.inertia;
            inertiaVal.textContent = state.inertia.toFixed(2);
            speedSlider.value = state.autoPlaySpeed;
            speedVal.textContent = `${state.autoPlaySpeed.toFixed(1)}x`;
            
            const originalText = btn.textContent;
            btn.textContent = 'CONFIG LOADED ✓';
            btn.style.backgroundColor = 'var(--accent-color)';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.backgroundColor = '';
            }, 1500);
        });
    });
}

// 5. Initializer
async function init() {
    initControls();
    initDragRotate();
    initThemeCustomizer();
    initOverlayMenu();
    initComponentTabs();
    initPollingSimulator();
    initWeightSimulator();
    initProCards();
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
