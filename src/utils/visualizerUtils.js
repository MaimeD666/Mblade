// visualizerUtils.js - Common utilities for visualizers
export const getThemeColors = () => {
    const getColor = (varName) =>
        getComputedStyle(document.documentElement)
            .getPropertyValue(varName)
            .trim();

    // Extract theme colors from CSS variables
    return {
        primary: getColor('--accent-color') || '#b53ad4',
        secondary: getColor('--active-accent') || '#d252f4',
        tertiary: getColor('--progress-knob-color') || '#64e0ff',
        background: getColor('--secondary-bg') || '#6c227e',
        text: getColor('--text-color') || '#ffffff',

        // Gradients for visualizer
        visualizerGradient: {
            barStart: getColor('--accent-color') || '#b53ad4',
            barEnd: getColor('--active-accent') || '#d252f4',
            waveStart: getColor('--progress-knob-color') || '#64e0ff',
            waveEnd: getColor('--active-accent') || '#d252f4',
            circleInner: getColor('--active-accent') || '#d252f4',
            circleOuter: getColor('--accent-color') || '#b53ad4'
        }
    };
};

// Detect if audio has activity
export const checkForAudioData = (data, isTimeData = false) => {
    if (!data) return false;
    if (!isTimeData) {
        for (let i = 0; i < data.length; i++) {
            if (data[i] > 0) {
                return true;
            }
        }
    } else {
        for (let i = 0; i < data.length; i++) {
            if (Math.abs(data[i] - 128) > 2) {
                return true;
            }
        }
    }
    return false;
};