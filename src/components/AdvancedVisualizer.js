import { getThemeColors } from './visualizerUtils';

export const ADVANCED_VISUALIZER_TYPES = {
    NEON_RINGS: 'neon_rings',
    SPECTRUM_WAVE: 'spectrum_wave',
};

export const ADVANCED_VISUALIZER_NAMES = {
    [ADVANCED_VISUALIZER_TYPES.NEON_RINGS]: 'Неоновые кольца',
    [ADVANCED_VISUALIZER_TYPES.SPECTRUM_WAVE]: 'Спектр-волна',
};

export const isAdvancedVisualizerType = (t) =>
    Object.values(ADVANCED_VISUALIZER_TYPES).includes(t);

const drawNeonRings = (ctx, freq, canvas, idle, { ringCount = 7 } = {}) => {
    const { visualizerGradient } = getThemeColors();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const cx = canvas.width / dpr / 2;
    const cy = canvas.height / dpr / 2;
    const Rmax = Math.min(cx, cy) * 0.8;
    const band = Math.floor(freq.length / ringCount);
    const phase = performance.now() / 1000;
    for (let i = 0; i < ringCount; i++) {
        const base = Rmax * (1 - (i / ringCount) * 0.8);
        const avg = idle ? 0.1 : freq.slice(i * band, (i + 1) * band).reduce((s, v) => s + v, 0) / band / 255;
        const radius = base * (1 + avg * 0.25);
        ctx.beginPath();
        const seg = 120;
        const step = (Math.PI * 2) / seg;
        for (let j = 0; j <= seg; j++) {
            const a = j * step;
            const distort = Math.sin(a * 3 + phase + i) * 0.03 * (1 + avg);
            const r = radius * (1 + distort);
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = visualizerGradient.waveStart;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = visualizerGradient.waveStart;
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, Rmax * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = visualizerGradient.waveEnd;
    ctx.shadowBlur = 15;
    ctx.shadowColor = visualizerGradient.waveEnd;
    ctx.fill();
};

const drawSpectrumWave = (ctx, freq, time, canvas, idle) => {
    const { primary, secondary, tertiary } = getThemeColors();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const mid = h / 2;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, primary);
    grad.addColorStop(0.5, secondary);
    grad.addColorStop(1, tertiary);
    const points = 220;
    const drawWave = (invert = false, alpha = 1) => {
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
            const x = (i / points) * w;
            let y;
            if (idle) {
                const amp = h * (invert ? 0.1 : 0.2);
                y = mid + (invert ? 1 : -1) * Math.sin((i / points) * Math.PI * 8 + performance.now() / 300) * amp;
            } else {
                const tIndex = Math.min(Math.floor((i * time.length) / points), time.length - 1);
                const fIndex = Math.min(Math.floor((i * freq.length) / points), freq.length - 1);
                const amp = h * 0.25 * (0.5 + freq[fIndex] / 255);
                y = mid + (invert ? 1 : -1) * ((time[tIndex] - 128) / 128) * amp;
            }
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 15 * alpha;
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.stroke();
        ctx.globalAlpha = 1;
    };
    drawWave(false, 1);
    drawWave(true, 0.3);
};


export const drawAdvancedVisualizer = (type, ctx, freq, time, canvas, idle = false, options = {}) => {
    switch (type) {
        case ADVANCED_VISUALIZER_TYPES.NEON_RINGS:
            drawNeonRings(ctx, freq, canvas, idle, options);
            break;
        case ADVANCED_VISUALIZER_TYPES.SPECTRUM_WAVE:
            drawSpectrumWave(ctx, freq, time, canvas, idle);
            break;
    }
};
