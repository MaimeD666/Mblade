const themes = {
  purple: {
    name: 'Фиолетовая',
    colors: {
      primaryBg: '#4a0263',
      secondaryBg: '#6a1b7e',
      accentColor: '#c83ad8',
      activeAccent: '#e252ff',
      textColor: '#ffffff',
      textColorSecondary: 'rgba(255, 255, 255, 0.8)',
      textColorTertiary: 'rgba(255, 255, 255, 0.6)',
      errorColor: '#ff3a3a',
      successColor: '#4cd964',
      warningColor: '#ffcc00',
      cardBg: '#b53ad4',
      controlBg: '#c165dd',
      buttonHover: '#da5aff',
      backgroundOverlay: 'rgba(0, 0, 0, 0.65)',
      modalBg: '#6a1b7e',
      sliderBg: 'rgba(200, 58, 216, 0.6)',
      progressBarBg: 'linear-gradient(90deg, #64e0ff, #a0fffd)',
      volumeBarBg: 'linear-gradient(0deg, #64e0ff, #a0fffd)',
      loveLevelGradient: 'linear-gradient(135deg, #c83ad8, #f07cff)',
      accentGradient: 'linear-gradient(45deg, #c83ad8, #e252ff)',
      progressKnobColor: '#64e0ff',
      cardShadow: '0 5px 15px rgba(74, 2, 99, 0.4)',
      buttonShadow: '0 4px 10px rgba(200, 58, 216, 0.3)',
      modalShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
      progressKnobShadow: '0 0 12px rgba(100, 224, 255, 0.7)',
      visualizerWaveColor: '#64e0ff',
    },
    loveGradients: [
      'linear-gradient(135deg, #c83ad8, #e87cff)',
      'linear-gradient(135deg, #c83ad8, #ff7af5)',
      'linear-gradient(135deg, #d93adc, #ff7af5)',
      'linear-gradient(135deg, #e33add, #ff7af5)',
      'linear-gradient(135deg, #ee3ade, #ff7af5)',
      'linear-gradient(135deg, #ff3ade, #ff7af5)',
      'linear-gradient(135deg, #ff3ab9, #ff7af5)',
      'linear-gradient(135deg, #ff3a8c, #ff7af5)',
      'linear-gradient(135deg, #ff3a5e, #ff7af5)',
      'linear-gradient(135deg, #ff3a3a, #fffc7a)'
    ]
  },

  dark: {
    name: 'Темная',
    colors: {
      primaryBg: '#121212',
      secondaryBg: '#1e1e1e',
      accentColor: '#8c43ff',
      activeAccent: '#9e5eff',
      textColor: '#ffffff',
      textColorSecondary: 'rgba(255, 255, 255, 0.7)',
      textColorTertiary: 'rgba(255, 255, 255, 0.5)',
      errorColor: '#ff3a3a',
      successColor: '#4cd964',
      warningColor: '#ffcc00',
      cardBg: '#2d2d2d',
      controlBg: '#3a3a3a',
      buttonHover: '#404040',
      backgroundOverlay: 'rgba(0, 0, 0, 0.8)',
      modalBg: '#252525',
      sliderBg: 'rgba(140, 67, 255, 0.6)',
      progressBarBg: 'linear-gradient(90deg, #8c43ff, #7a6bff)',
      volumeBarBg: 'linear-gradient(0deg, #8c43ff, #7a6bff)',
      loveLevelGradient: 'linear-gradient(135deg, #8c43ff, #a670ff)',
      accentGradient: 'linear-gradient(45deg, #8c43ff, #9e5eff)',
      progressKnobColor: '#9e5eff',
      cardShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
      buttonShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
      modalShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
      progressKnobShadow: '0 0 10px rgba(158, 94, 255, 0.7)',
      visualizerWaveColor: '#9e5eff',
    },
    loveGradients: [
      'linear-gradient(135deg, #8c43ff, #a670ff)',
      'linear-gradient(135deg, #8c43ff, #b184ff)',
      'linear-gradient(135deg, #9555ff, #b184ff)',
      'linear-gradient(135deg, #9e67ff, #b184ff)',
      'linear-gradient(135deg, #a778ff, #b184ff)',
      'linear-gradient(135deg, #af8aff, #b184ff)',
      'linear-gradient(135deg, #b89cff, #bca1ff)',
      'linear-gradient(135deg, #c0aeff, #c7b4ff)',
      'linear-gradient(135deg, #c9c0ff, #d2caff)',
      'linear-gradient(135deg, #d2d2ff, #e1e1ff)'
    ]
  },

  light: {
    name: 'Светлая',
    colors: {
      primaryBg: '#fafbfc',
      secondaryBg: '#ffffff',
      accentColor: '#6366f1',
      activeAccent: '#4f46e5',
      textColor: '#1f2937',
      textColorSecondary: 'rgba(31, 41, 55, 0.8)',
      textColorTertiary: 'rgba(31, 41, 55, 0.6)',
      errorColor: '#ef4444',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      cardBg: '#f8fafc',
      controlBg: '#f1f5f9',
      buttonHover: '#e2e8f0',
      backgroundOverlay: 'rgba(248, 250, 252, 0.95)',
      modalBg: '#ffffff',
      sliderBg: 'rgba(99, 102, 241, 0.15)',
      progressBarBg: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
      volumeBarBg: 'linear-gradient(0deg, #6366f1, #8b5cf6)',
      loveLevelGradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      accentGradient: 'linear-gradient(45deg, #6366f1, #4f46e5)',
      progressKnobColor: '#6366f1',
      cardShadow: '0 4px 16px rgba(99, 102, 241, 0.08)',
      buttonShadow: '0 2px 8px rgba(99, 102, 241, 0.12)',
      modalShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
      progressKnobShadow: '0 0 16px rgba(99, 102, 241, 0.3)',
      visualizerWaveColor: '#6366f1',
    },
    loveGradients: [
      'linear-gradient(135deg, #6366f1, #8b5cf6)',
      'linear-gradient(135deg, #7c3aed, #a855f7)',
      'linear-gradient(135deg, #9333ea, #c084fc)',
      'linear-gradient(135deg, #a855f7, #d946ef)',
      'linear-gradient(135deg, #c084fc, #e879f9)',
      'linear-gradient(135deg, #d946ef, #f0abfc)',
      'linear-gradient(135deg, #e879f9, #fbbf24)',
      'linear-gradient(135deg, #f0abfc, #fb7185)',
      'linear-gradient(135deg, #fbbf24, #f87171)',
      'linear-gradient(135deg, #fb7185, #ef4444)'
    ]
  },

  frosted_glass: {
    name: 'Матовое стекло',
    colors: {
      primaryBg: '#0a0a0a',
      secondaryBg: 'rgba(25, 25, 35, 0.7)',
      accentColor: '#8b5cf6',
      activeAccent: '#a78bfa',
      textColor: '#ffffff',
      textColorSecondary: 'rgba(255, 255, 255, 0.8)',
      textColorTertiary: 'rgba(255, 255, 255, 0.6)',
      errorColor: '#ef4444',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      cardBg: 'rgba(30, 30, 45, 0.6)',
      controlBg: 'rgba(40, 40, 60, 0.8)',
      buttonHover: 'rgba(55, 55, 80, 0.9)',
      backgroundOverlay: 'rgba(0, 0, 0, 0.75)',
      modalBg: 'rgba(20, 20, 30, 0.85)',
      sliderBg: 'rgba(139, 92, 246, 0.3)',
      progressBarBg: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
      volumeBarBg: 'linear-gradient(0deg, #8b5cf6, #a78bfa)',
      loveLevelGradient: 'linear-gradient(135deg, #8b5cf6, #c084fc)',
      accentGradient: 'linear-gradient(45deg, #8b5cf6, #a78bfa)',
      progressKnobColor: '#c084fc',
      cardShadow: '0 8px 32px rgba(139, 92, 246, 0.15)',
      buttonShadow: '0 4px 16px rgba(139, 92, 246, 0.25)',
      modalShadow: '0 25px 50px rgba(0, 0, 0, 0.45)',
      progressKnobShadow: '0 0 20px rgba(192, 132, 252, 0.6)',
      visualizerWaveColor: '#c084fc',
      glassBlur: '10px',
      glassBorder: 'rgba(255, 255, 255, 0.1)',
      glassHighlight: 'rgba(255, 255, 255, 0.05)',
      glassShadow: 'rgba(0, 0, 0, 0.3)',
    },
    loveGradients: [
      'linear-gradient(135deg, #8b5cf6, #a78bfa)',
      'linear-gradient(135deg, #9333ea, #a855f7)',
      'linear-gradient(135deg, #7c3aed, #8b5cf6)',
      'linear-gradient(135deg, #6d28d9, #7c3aed)',
      'linear-gradient(135deg, #5b21b6, #6d28d9)',
      'linear-gradient(135deg, #581c87, #5b21b6)',
      'linear-gradient(135deg, #4c1d95, #581c87)',
      'linear-gradient(135deg, #3730a3, #4c1d95)',
      'linear-gradient(135deg, #312e81, #3730a3)',
      'linear-gradient(135deg, #1e1b4b, #312e81)'
    ]
  }
};

const THEME_STORAGE_KEY = 'musicAppTheme';
const ACCENT_COLORS_KEY_PREFIX = 'accentColor_';
const VISUALIZER_WAVE_COLOR_KEY_PREFIX = 'visualizerWaveColor_';
const THEME_INIT_COMPLETED_KEY = 'themeInitCompleted';

const hexToRgb = (hex) => {
  hex = hex.replace(/^#/, '');

  if (!/^[0-9A-F]{6}$/i.test(hex) && !/^[0-9A-F]{8}$/i.test(hex)) {
    return null;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `${r}, ${g}, ${b}`;
};

const parseColorToRgb = (color) => {
  if (!color || typeof color !== 'string') {
    console.warn("Некорректное значение цвета:", color);
    return null;
  }

  if (color.startsWith('#')) {
    return hexToRgb(color);
  } else if (color.startsWith('rgba')) {
    const match = color.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/);
    if (match && match.length >= 4) {
      return `${match[1]}, ${match[2]}, ${match[3]}`;
    }
  } else if (color.startsWith('rgb')) {
    const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match && match.length >= 4) {
      return `${match[1]}, ${match[2]}, ${match[3]}`;
    }
  }
  return null;
};

const hexToHsl = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const [r, g, b] = rgb.split(', ').map(Number);

  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);

  let h, s, l = (max + min) / 2;

  const isVeryDark = max < 0.05;

  if (max === min || isVeryDark) {
    h = 240;
    s = isVeryDark ? 10 : 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }

    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    isVeryDark: isVeryDark
  };
};

const hslToHex = (h, s, l) => {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const generateGradient = (baseColor, secondColor, angle = 135) => {
  return `linear-gradient(${angle}deg, ${baseColor}, ${secondColor})`;
};

const generateGlassBackgrounds = (accentRgb, h, s, l) => {
  const darkBaseH = h;
  const darkBaseS = Math.max(20, s - 30);
  const darkBaseL = Math.max(8, l - 50);

  const mediumBaseH = h;
  const mediumBaseS = Math.max(15, s - 40);
  const mediumBaseL = Math.max(15, l - 40);

  const lightBaseH = h;
  const lightBaseS = Math.max(10, s - 50);
  const lightBaseL = Math.max(25, l - 30);

  const darkBaseColor = hslToHex(darkBaseH, darkBaseS, darkBaseL);
  const mediumBaseColor = hslToHex(mediumBaseH, mediumBaseS, mediumBaseL);
  const lightBaseColor = hslToHex(lightBaseH, lightBaseS, lightBaseL);

  const darkBaseRgb = parseColorToRgb(darkBaseColor);
  const mediumBaseRgb = parseColorToRgb(mediumBaseColor);
  const lightBaseRgb = parseColorToRgb(lightBaseColor);

  return {
    secondaryBg: `rgba(${darkBaseRgb}, 0.7)`,
    cardBg: `rgba(${mediumBaseRgb}, 0.6)`,
    controlBg: `rgba(${lightBaseRgb}, 0.8)`,
    buttonHover: `rgba(${lightBaseRgb}, 0.9)`,
    modalBg: `rgba(${darkBaseRgb}, 0.85)`,
    sliderBg: `rgba(${accentRgb}, 0.3)`
  };
};

const generateThemeColors = (accentHex, themeName) => {
  const accentHsl = hexToHsl(accentHex);
  if (!accentHsl) return null;

  const { h, s, l, isVeryDark } = accentHsl;

  if (themeName === 'frosted_glass') {
    const activeAccentHex = hslToHex(h, Math.min(100, s + 10), Math.min(90, l + 10));
    const progressKnobHex = hslToHex((h + 20) % 360, Math.min(100, s), Math.min(85, l + 15));

    const accentRgb = parseColorToRgb(accentHex);
    const progressKnobRgb = parseColorToRgb(progressKnobHex);

    const glassBackgrounds = generateGlassBackgrounds(accentRgb, h, s, l);

    const loveGradients = Array(10).fill(0).map((_, i) => {
      const startH = (h + i * 8) % 360;
      const endH = (startH + 25) % 360;
      const startL = Math.max(40, Math.min(80, l + i * 3));
      const endL = Math.max(30, Math.min(70, l - i * 2));

      const startColor = hslToHex(startH, Math.min(100, s), startL);
      const endColor = hslToHex(endH, Math.min(100, s - 10), endL);

      return generateGradient(startColor, endColor);
    });

    return {
      primaryBg: '#0a0a0a',
      secondaryBg: glassBackgrounds.secondaryBg,
      accentColor: accentHex,
      activeAccent: activeAccentHex,
      textColor: '#ffffff',
      textColorSecondary: 'rgba(255, 255, 255, 0.8)',
      textColorTertiary: 'rgba(255, 255, 255, 0.6)',
      errorColor: '#ef4444',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      cardBg: glassBackgrounds.cardBg,
      controlBg: glassBackgrounds.controlBg,
      buttonHover: glassBackgrounds.buttonHover,
      backgroundOverlay: 'rgba(0, 0, 0, 0.75)',
      modalBg: glassBackgrounds.modalBg,
      sliderBg: glassBackgrounds.sliderBg,
      progressBarBg: generateGradient(accentHex, activeAccentHex, 90),
      volumeBarBg: generateGradient(accentHex, activeAccentHex, 0),
      loveLevelGradient: generateGradient(accentHex, progressKnobHex),
      accentGradient: generateGradient(accentHex, activeAccentHex, 45),
      progressKnobColor: progressKnobHex,
      cardShadow: `0 8px 32px rgba(${accentRgb}, 0.15)`,
      buttonShadow: `0 4px 16px rgba(${accentRgb}, 0.25)`,
      modalShadow: '0 25px 50px rgba(0, 0, 0, 0.45)',
      progressKnobShadow: `0 0 20px rgba(${progressKnobRgb}, 0.6)`,
      visualizerWaveColor: getVisualizerWaveColor(themeName) || progressKnobHex,
      glassBlur: '10px',
      glassBorder: 'rgba(255, 255, 255, 0.1)',
      glassHighlight: 'rgba(255, 255, 255, 0.05)',
      glassShadow: 'rgba(0, 0, 0, 0.3)',
      loveGradients
    };
  }

  if (isVeryDark) {
    const darkThemeColors = {
      primaryBg: '#121212',
      secondaryBg: '#1e1e1e',
      accentColor: accentHex,
      activeAccent: l < 1 ? '#333333' : accentHex,
      textColor: '#ffffff',
      textColorSecondary: 'rgba(255, 255, 255, 0.7)',
      textColorTertiary: 'rgba(255, 255, 255, 0.5)',
      errorColor: '#ff3a3a',
      successColor: '#4cd964',
      warningColor: '#ffcc00',
      cardBg: '#2d2d2d',
      controlBg: '#3a3a3a',
      buttonHover: '#404040',
      backgroundOverlay: 'rgba(0, 0, 0, 0.8)',
      modalBg: '#252525',
      sliderBg: `rgba(${parseColorToRgb(accentHex) || '50, 50, 50'}, 0.6)`,
      progressBarBg: `linear-gradient(90deg, ${accentHex}, #555555)`,
      volumeBarBg: `linear-gradient(0deg, ${accentHex}, #555555)`,
      loveLevelGradient: `linear-gradient(135deg, ${accentHex}, #555555)`,
      accentGradient: `linear-gradient(45deg, ${accentHex}, #555555)`,
      progressKnobColor: '#555555',
      cardShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
      buttonShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
      modalShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
      progressKnobShadow: '0 0 10px rgba(80, 80, 80, 0.7)',
      visualizerWaveColor: getVisualizerWaveColor(themeName) || '#555555'
    };

    const darkGradients = Array(10).fill(0).map((_, i) => {
      const intensityValue = Math.min(50 + i * 15, 170);
      const intensityHex = `#${intensityValue.toString(16)}${intensityValue.toString(16)}${intensityValue.toString(16)}`;
      return `linear-gradient(135deg, ${accentHex}, ${intensityHex})`;
    });

    return {
      ...darkThemeColors,
      loveGradients: darkGradients
    };
  }

  const activeAccentHex = hslToHex(h, Math.min(100, s + 5), Math.min(100, l + 15));

  let primaryBgHex, secondaryBgHex, textColor, textColorSecondary, textColorTertiary;

  if (themeName === 'light') {
    primaryBgHex = '#fafbfc';
    secondaryBgHex = '#ffffff';
    textColor = '#1f2937';
    textColorSecondary = 'rgba(31, 41, 55, 0.8)';
    textColorTertiary = 'rgba(31, 41, 55, 0.6)';
  } else if (themeName === 'dark') {
    primaryBgHex = '#121212';
    secondaryBgHex = '#1e1e1e';
    textColor = '#ffffff';
    textColorSecondary = 'rgba(255, 255, 255, 0.7)';
    textColorTertiary = 'rgba(255, 255, 255, 0.5)';
  } else {
    primaryBgHex = hslToHex(h, Math.max(50, s - 20), Math.max(5, l - 45));
    secondaryBgHex = hslToHex(h, Math.max(50, s - 15), Math.max(15, l - 35));
    textColor = '#ffffff';
    textColorSecondary = 'rgba(255, 255, 255, 0.8)';
    textColorTertiary = 'rgba(255, 255, 255, 0.6)';
  }

  const controlBgHex = hslToHex(h, Math.min(95, s + 5), Math.max(30, l - 5));
  const buttonHoverHex = hslToHex(h, Math.min(100, s + 10), Math.min(90, l + 10));

  const progressKnobHex = hslToHex((h + 30) % 360, Math.min(100, s), Math.min(90, l + 15));

  const visualizerWaveColorHex = getVisualizerWaveColor(themeName) || progressKnobHex;

  const loveGradients = [];

  for (let i = 0; i < 10; i++) {
    const startH = (h + i * 5) % 360;
    const endH = (startH + 15) % 360;

    const startL = Math.min(90, l + i * 2);
    const endL = Math.min(95, l + 5 + i * 2);

    const startColor = hslToHex(startH, Math.min(100, s), startL);
    const endColor = hslToHex(endH, Math.min(100, s - 10), endL);

    loveGradients.push(generateGradient(startColor, endColor));
  }

  return {
    primaryBg: primaryBgHex,
    secondaryBg: secondaryBgHex,
    accentColor: accentHex,
    activeAccent: activeAccentHex,
    textColor,
    textColorSecondary,
    textColorTertiary,
    errorColor: themeName === 'light' ? '#ef4444' : '#ff3a3a',
    successColor: themeName === 'light' ? '#10b981' : '#4cd964',
    warningColor: themeName === 'light' ? '#f59e0b' : '#ffcc00',
    cardBg: themeName === 'light' ? '#f8fafc' : controlBgHex,
    controlBg: themeName === 'light' ? '#f1f5f9' : controlBgHex,
    buttonHover: themeName === 'light' ? '#e2e8f0' : buttonHoverHex,
    backgroundOverlay: themeName === 'light' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(0, 0, 0, 0.8)',
    modalBg: themeName === 'light' ? '#ffffff' : secondaryBgHex,
    sliderBg: themeName === 'light' ? `rgba(${parseColorToRgb(accentHex)}, 0.15)` : `rgba(${parseColorToRgb(accentHex)}, 0.6)`,
    progressBarBg: generateGradient(accentHex, progressKnobHex, 90),
    volumeBarBg: generateGradient(accentHex, progressKnobHex, 0),
    loveLevelGradient: generateGradient(accentHex, activeAccentHex),
    accentGradient: generateGradient(accentHex, activeAccentHex, 45),
    progressKnobColor: progressKnobHex,
    cardShadow: themeName === 'light' ? `0 4px 16px rgba(${parseColorToRgb(accentHex)}, 0.08)` : `0 5px 15px rgba(${parseColorToRgb(primaryBgHex)}, 0.4)`,
    buttonShadow: themeName === 'light' ? `0 2px 8px rgba(${parseColorToRgb(accentHex)}, 0.12)` : `0 4px 10px rgba(${parseColorToRgb(accentHex)}, 0.3)`,
    modalShadow: themeName === 'light' ? '0 20px 40px rgba(0, 0, 0, 0.08)' : '0 10px 30px rgba(0, 0, 0, 0.35)',
    progressKnobShadow: themeName === 'light' ? `0 0 16px rgba(${parseColorToRgb(progressKnobHex)}, 0.3)` : `0 0 12px rgba(${parseColorToRgb(progressKnobHex)}, 0.7)`,
    visualizerWaveColor: visualizerWaveColorHex,
    loveGradients
  };
};

const applyTheme = (themeName) => {
  const theme = themes[themeName] || themes.purple;

  const savedAccentColor = getThemeAccentColor(themeName);
  if (savedAccentColor && savedAccentColor !== theme.colors.accentColor) {
    console.log(`[Theme] Обнаружен сохраненный акцентный цвет: ${savedAccentColor}`);

    const newColors = generateThemeColors(savedAccentColor, themeName);
    if (newColors) {
      theme.colors = newColors;
      theme.loveGradients = newColors.loveGradients;
      console.log(`[Theme] Применен сохраненный акцентный цвет: ${savedAccentColor}`);
    }
  }

  const savedWaveColor = getVisualizerWaveColor(themeName);
  if (savedWaveColor && savedWaveColor !== theme.colors.visualizerWaveColor) {
    console.log(`[Theme] Применяем сохраненный цвет волны визуализатора: ${savedWaveColor}`);
    theme.colors.visualizerWaveColor = savedWaveColor;
  }

  const root = document.documentElement;

  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(`--${cssVarName}`, value);

    const rgbValue = parseColorToRgb(value);
    if (rgbValue) {
      root.style.setProperty(`--${cssVarName}-rgb`, rgbValue);
    }
  });

  if (themeName === 'frosted_glass') {
    root.style.setProperty('--glass-blur', theme.colors.glassBlur || '10px');
    root.style.setProperty('--glass-border', theme.colors.glassBorder || 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--glass-highlight', theme.colors.glassHighlight || 'rgba(255, 255, 255, 0.05)');
    root.style.setProperty('--glass-shadow', theme.colors.glassShadow || 'rgba(0, 0, 0, 0.3)');

    if (CSS.supports('backdrop-filter', 'blur(1px)')) {
      root.style.setProperty('--backdrop-filter-support', '1');
    } else {
      root.style.setProperty('--backdrop-filter-support', '0');
      console.warn('Браузер не поддерживает backdrop-filter. Эффект матового стекла может не работать.');
    }

    const isLowPerformance = navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 4;
    if (isLowPerformance) {
      root.style.setProperty('--glass-blur-reduced', '5px');
    } else {
      root.style.setProperty('--glass-blur-reduced', '15px');
    }
  }

  theme.loveGradients.forEach((gradient, index) => {
    root.style.setProperty(`--love-level-gradient-${index + 1}`, gradient);
  });

  localStorage.setItem(THEME_STORAGE_KEY, themeName);

  fetch('/api/save-theme-settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ themeName })
  }).catch(err => {
    console.log('Ошибка сохранения темы на сервере:', err);
  });

  document.body.className = `theme-${themeName.replace('_', '-')}`;

  console.log(`Применена тема: ${theme.name}, акцентный цвет: ${theme.colors.accentColor}`);

  return theme;
};

const saveThemeSettings = (themeName) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeName);

    fetch('/api/save-theme-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ themeName })
    }).catch(err => {
      console.log('Ошибка сохранения темы на сервере:', err);
    });
  } catch (e) {
    console.error('Ошибка при сохранении настроек темы:', e);
  }
};

const saveAccentColor = (themeName, accentColor) => {
  try {
    localStorage.setItem(`${ACCENT_COLORS_KEY_PREFIX}${themeName}`, accentColor);

    fetch('/api/save-accent-color', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ themeName, accentColor })
    }).catch(err => {
      console.log('Ошибка сохранения акцентного цвета на сервере:', err);
    });
  } catch (e) {
    console.error('Ошибка при сохранении акцентного цвета:', e);
  }
};

const saveVisualizerWaveColor = (themeName, waveColor) => {
  try {
    localStorage.setItem(`${VISUALIZER_WAVE_COLOR_KEY_PREFIX}${themeName}`, waveColor);

    fetch('/api/save-visualizer-wave-color', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ themeName, waveColor })
    }).catch(err => {
      console.log('Ошибка сохранения цвета волны визуализатора на сервере:', err);
    });
  } catch (e) {
    console.error('Ошибка при сохранении цвета волны визуализатора:', e);
  }
};

const getCurrentTheme = () => {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && themes[savedTheme]) {
      return savedTheme;
    }

    return 'purple';
  } catch (e) {
    console.error('Ошибка при получении текущей темы:', e);
    return 'purple';
  }
};

const initTheme = () => {
  console.log('[Theme] Инициализация темы...');

  fetch('/api/get-theme-settings')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('[Theme] Получены данные с сервера:', data);

      const currentTheme = getCurrentTheme();

      console.log(`[Theme] Применяем базовую тему: ${currentTheme}`);
      applyTheme(currentTheme);

      const serverAccentColor = data.accentColor;

      if (serverAccentColor) {
        console.log(`[Theme] Применяем акцентный цвет с сервера: ${serverAccentColor}`);
        changeAccentColor(currentTheme, serverAccentColor);
      } else {
        const localAccentColor = getThemeAccentColor(currentTheme);
        if (localAccentColor) {
          console.log(`[Theme] Применяем акцентный цвет из localStorage: ${localAccentColor}`);
          changeAccentColor(currentTheme, localAccentColor);
          saveAccentColor(currentTheme, localAccentColor);
        }
      }

      const serverWaveColor = data.visualizerWaveColor;
      if (serverWaveColor) {
        console.log(`[Theme] Применяем цвет волны визуализатора с сервера: ${serverWaveColor}`);
        changeVisualizerWaveColor(currentTheme, serverWaveColor);
      } else {
        const localWaveColor = getVisualizerWaveColor(currentTheme);
        if (localWaveColor) {
          console.log(`[Theme] Применяем цвет волны визуализатора из localStorage: ${localWaveColor}`);
          changeVisualizerWaveColor(currentTheme, localWaveColor);
          saveVisualizerWaveColor(currentTheme, localWaveColor);
        }
      }

      localStorage.setItem(THEME_INIT_COMPLETED_KEY, 'true');
    })
    .catch(err => {
      console.log('[Theme] Ошибка загрузки настроек темы с сервера:', err);

      const currentTheme = getCurrentTheme();
      console.log(`[Theme] Применяем базовую тему из localStorage: ${currentTheme}`);
      applyTheme(currentTheme);

      const localAccentColor = getThemeAccentColor(currentTheme);
      if (localAccentColor) {
        console.log(`[Theme] Применяем акцентный цвет из localStorage: ${localAccentColor}`);
        changeAccentColor(currentTheme, localAccentColor);
      }

      const localWaveColor = getVisualizerWaveColor(currentTheme);
      if (localWaveColor) {
        console.log(`[Theme] Применяем цвет волны визуализатора из localStorage: ${localWaveColor}`);
        changeVisualizerWaveColor(currentTheme, localWaveColor);
      }

      localStorage.setItem(THEME_INIT_COMPLETED_KEY, 'true');
    });
};

const changeTheme = (themeName) => {
  if (!themes[themeName]) {
    console.error(`Тема "${themeName}" не найдена!`);
    return null;
  }

  return applyTheme(themeName);
};

const getAvailableThemes = () => {
  return Object.entries(themes).map(([id, theme]) => ({
    id,
    name: theme.name
  }));
};

const updateThemeColor = (themeName, colorKey, newValue) => {
  if (!themes[themeName]) {
    console.error(`Тема "${themeName}" не найдена!`);
    return false;
  }

  if (!themes[themeName].colors[colorKey]) {
    console.error(`Цвет "${colorKey}" не найден в теме "${themeName}"!`);
    return false;
  }

  themes[themeName].colors[colorKey] = newValue;

  if (getCurrentTheme() === themeName) {
    const cssVarName = colorKey.replace(/([A-Z])/g, '-$1').toLowerCase();
    document.documentElement.style.setProperty(`--${cssVarName}`, newValue);

    const rgbValue = parseColorToRgb(newValue);
    if (rgbValue) {
      document.documentElement.style.setProperty(`--${cssVarName}-rgb`, rgbValue);
    }
  }

  return true;
};

const changeAccentColor = (themeName, accentColor) => {
  if (!themes[themeName]) {
    console.error(`Тема "${themeName}" не найдена!`);
    return false;
  }

  const newColors = generateThemeColors(accentColor, themeName);
  if (!newColors) {
    console.error(`Не удалось сгенерировать цвета для темы "${themeName}"!`);
    return false;
  }

  themes[themeName].colors = newColors;
  themes[themeName].loveGradients = newColors.loveGradients;

  if (getCurrentTheme() === themeName) {
    applyTheme(themeName);
  }

  saveAccentColor(themeName, accentColor);

  return true;
};

const changeVisualizerWaveColor = (themeName, waveColor) => {
  if (!themes[themeName]) {
    console.error(`Тема "${themeName}" не найдена!`);
    return false;
  }

  updateThemeColor(themeName, 'visualizerWaveColor', waveColor);

  document.documentElement.style.setProperty('--visualizer-wave-color', waveColor);

  saveVisualizerWaveColor(themeName, waveColor);

  return true;
};

const getThemeAccentColor = (themeName) => {
  try {
    const savedAccentColor = localStorage.getItem(`${ACCENT_COLORS_KEY_PREFIX}${themeName}`);
    if (savedAccentColor) {
      return savedAccentColor;
    }

    if (themes[themeName]) {
      return themes[themeName].colors.accentColor;
    }

    return null;
  } catch (e) {
    console.error('Ошибка при получении акцентного цвета:', e);
    if (themes[themeName]) {
      return themes[themeName].colors.accentColor;
    }
    return null;
  }
};

const getVisualizerWaveColor = (themeName) => {
  try {
    const savedWaveColor = localStorage.getItem(`${VISUALIZER_WAVE_COLOR_KEY_PREFIX}${themeName}`);
    if (savedWaveColor) {
      return savedWaveColor;
    }

    if (themes[themeName]) {
      return themes[themeName].colors.visualizerWaveColor || themes[themeName].colors.progressKnobColor;
    }

    return null;
  } catch (e) {
    console.error('Ошибка при получении цвета волны визуализатора:', e);
    if (themes[themeName]) {
      return themes[themeName].colors.visualizerWaveColor || themes[themeName].colors.progressKnobColor;
    }
    return null;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  setTimeout(() => {
    fetch('/api/get-theme-settings')
      .then(response => response.json())
      .then(data => {
        const currentTheme = getCurrentTheme();

        if (data.accentColor) {
          console.log(`[Theme] Проверка акцентного цвета: ${data.accentColor}`);
          const currentAccentColor = themes[currentTheme].colors.accentColor;
          if (currentAccentColor !== data.accentColor) {
            console.log(`[Theme] Обновление акцентного цвета: ${currentAccentColor} -> ${data.accentColor}`);
            changeAccentColor(currentTheme, data.accentColor);
          }
        }

        if (data.visualizerWaveColor) {
          console.log(`[Theme] Проверка цвета волны визуализатора: ${data.visualizerWaveColor}`);
          const currentWaveColor = themes[currentTheme].colors.visualizerWaveColor;
          if (currentWaveColor !== data.visualizerWaveColor) {
            console.log(`[Theme] Обновление цвета волны визуализатора: ${currentWaveColor} -> ${data.visualizerWaveColor}`);
            changeVisualizerWaveColor(currentTheme, data.visualizerWaveColor);
          }
        }
      })
      .catch(err => {
        console.log('[Theme] Ошибка проверки обновлений темы:', err);
      });
  }, 500);
});

const VISUALIZER_WAVE_GRADIENT_KEY = 'visualizer_wave_gradient_enabled';

const getVisualizerWaveGradientEnabled = () => {
  try {
    const saved = localStorage.getItem(VISUALIZER_WAVE_GRADIENT_KEY);
    return saved === null ? true : saved === 'true';
  } catch (e) {
    console.error('Ошибка при получении настроек градиента визуализатора:', e);
    return true;
  }
};

const saveVisualizerWaveGradientEnabled = (enabled) => {
  try {
    localStorage.setItem(VISUALIZER_WAVE_GRADIENT_KEY, String(enabled));

    fetch('/api/save-visualizer-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ waveGradientEnabled: enabled })
    }).catch(err => {
      console.log('Ошибка сохранения настроек градиента визуализатора:', err);
    });

    return true;
  } catch (e) {
    console.error('Ошибка при сохранении настроек градиента визуализатора:', e);
    return false;
  }
};

export {
  initTheme,
  applyTheme,
  changeTheme,
  getCurrentTheme,
  getAvailableThemes,
  updateThemeColor,
  changeAccentColor,
  getThemeAccentColor,
  changeVisualizerWaveColor,
  getVisualizerWaveColor,
  getVisualizerWaveGradientEnabled,
  saveVisualizerWaveGradientEnabled,
  themes
};