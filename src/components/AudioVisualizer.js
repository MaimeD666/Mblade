import React, { useEffect, useRef, useState } from 'react';
import audioContextService from '../services/audioContext';

const getThemeColors = () => {
  const getColor = (varName) =>
    getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();

  // Получаем цвет волны и настройку градиента
  const visualizerWaveColor = getColor('--visualizer-wave-color');
  const isGradientEnabled = getColor('--visualizer-wave-gradient-enabled') !== '0';

  // Если цвет волны не задан, используем цвет прогресс-ручки как запасной вариант
  const waveColor = visualizerWaveColor || getColor('--progress-knob-color') || '#64e0ff';

  // Создаем светлую версию цвета волны для градиента (если градиент включен)
  const createLighterColor = (hexColor) => {
    // Простая функция для создания более светлой версии цвета
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    // Увеличиваем яркость
    const lighterR = Math.min(255, r + 40);
    const lighterG = Math.min(255, g + 40);
    const lighterB = Math.min(255, b + 40);

    return `#${lighterR.toString(16).padStart(2, '0')}${lighterG.toString(16).padStart(2, '0')}${lighterB.toString(16).padStart(2, '0')}`;
  };

  const waveLighterColor = isGradientEnabled ? createLighterColor(waveColor) : waveColor;

  return {
    // Основные цвета темы для остальных элементов визуализатора
    primary: getColor('--accent-color') || '#b53ad4',
    secondary: getColor('--active-accent') || '#d252f4',
    tertiary: waveColor, // Используем цвет волны как третичный цвет
    background: getColor('--secondary-bg') || '#6c227e',
    text: getColor('--text-color') || '#ffffff',

    // Градиенты для визуализатора
    visualizerGradient: {
      barStart: getColor('--accent-color') || '#b53ad4',
      barEnd: getColor('--active-accent') || '#d252f4',
      // Для волны используем только заданный цвет и его светлую версию, если градиент включен
      waveStart: waveColor,
      waveEnd: waveLighterColor,
      circleInner: getColor('--active-accent') || '#d252f4',
      circleOuter: getColor('--accent-color') || '#b53ad4'
    },

    // Флаг, включен ли градиент
    isGradientEnabled: isGradientEnabled
  };
};

let sharedAudioContext = null;
let isAudioNodeConnected = false;
let sharedAnalyser = null;
let sharedSourceNode = null;
let visualizerAudioElement = null;
let visualizerSourceNode = null;
let isVisualizerAudioConnected = false;

const VISUALIZER_TYPES = {
  BARS: 'bars',
  WAVE: 'wave',
  WAVE_CENTERED: 'waveCentered',
  CIRCLE: 'circle'
};

const VISUALIZER_NAMES = {
  [VISUALIZER_TYPES.BARS]: 'Столбцы',
  [VISUALIZER_TYPES.WAVE]: 'Волна',
  [VISUALIZER_TYPES.WAVE_CENTERED]: 'Центр. волна',
  [VISUALIZER_TYPES.CIRCLE]: 'Круговой'
};

function AudioVisualizer({
  audioRef,
  visualizerType = VISUALIZER_TYPES.BARS,
  onChangeType,
  currentTrack,
}) {
  const canvasRef = useRef(null);
  const dataArrayRef = useRef(null);
  const timeDataArrayRef = useRef(null);
  const animationIdRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [currentType, setCurrentType] = useState(visualizerType);
  const [showMenu, setShowMenu] = useState(false);
  const animationCounterRef = useRef(0);
  const wavePhaseRef = useRef(0);
  const idleAnimationFrameRef = useRef(0);

  useEffect(() => {
    setCurrentType(visualizerType);
  }, [visualizerType]);

  useEffect(() => {
    if (!audioRef.current) {
      setError("Audio element not found");
      return;
    }

    const setupAudioNodes = async () => {
      try {
        console.log('[AudioVisualizer] Setting up with audioContextService');
        
        // Пытаемся использовать сервис
        try {
          await audioContextService.initialize(audioRef.current);
          sharedAnalyser = audioContextService.getAnalyser();
          sharedAudioContext = audioContextService.getContext();
          console.log('[AudioVisualizer] Using audioContextService');
        } catch (serviceError) {
          console.warn('[AudioVisualizer] Service failed, using fallback:', serviceError);
          
          // Fallback к старому коду
          if (!sharedAudioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
              throw new Error("Web Audio API not supported in this browser");
            }
            sharedAudioContext = new AudioContext();
          } else if (sharedAudioContext.state === 'suspended') {
            sharedAudioContext.resume();
          }

          if (!sharedAnalyser) {
            sharedAnalyser = sharedAudioContext.createAnalyser();
            sharedAnalyser.fftSize = 2048;
            sharedAnalyser.smoothingTimeConstant = 0.8;
          }
        }

        const isHlsTrack = currentTrack && currentTrack.isHls;
        if (isHlsTrack) {
          if (!visualizerAudioElement) {
            visualizerAudioElement = new Audio();
            visualizerAudioElement.crossOrigin = 'anonymous';
            visualizerAudioElement.volume = 0;
            if (currentTrack && currentTrack.visualizerUrl) {
              visualizerAudioElement.src = currentTrack.visualizerUrl;
              visualizerAudioElement.load();
              if (audioRef.current && !audioRef.current.paused) {
                visualizerAudioElement.play().catch(err => {
                  console.error('[Visualizer] Ошибка воспроизведения:', err);
                });
              }
            }
          }
          if (!isVisualizerAudioConnected && visualizerAudioElement) {
            try {
              if (visualizerSourceNode) {
                visualizerSourceNode.disconnect();
              }
              visualizerSourceNode = sharedAudioContext.createMediaElementSource(visualizerAudioElement);
              visualizerSourceNode.connect(sharedAnalyser);
              isVisualizerAudioConnected = true;
            } catch (e) {
              console.error('[Visualizer] Ошибка подключения аудиоэлемента для визуализации:', e);
            }
          }
        } else {
          // Для обычных треков - подключаем только если сервис не сработал
          if (!audioContextService.isReady() && !isAudioNodeConnected && audioRef.current.src) {
            try {
              if (visualizerSourceNode && isVisualizerAudioConnected) {
                visualizerSourceNode.disconnect();
                isVisualizerAudioConnected = false;
              }

              audioRef.current.crossOrigin = "anonymous";

              sharedSourceNode = sharedAudioContext.createMediaElementSource(audioRef.current);
              isAudioNodeConnected = true;
              sharedSourceNode.connect(sharedAnalyser);
              sharedSourceNode.connect(sharedAudioContext.destination);
              console.log('[AudioVisualizer] Connected with fallback method');
            } catch (e) {
              if (e.name === 'InvalidStateError') {
                console.warn("[AudioVisualizer] Audio element already connected");
                isAudioNodeConnected = true;
              } else {
                throw e;
              }
            }
          }
        }

        const bufferLength = sharedAnalyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        timeDataArrayRef.current = new Uint8Array(bufferLength);

        return true;
      } catch (e) {
        console.error("[AudioVisualizer] Setup error:", e);
        setError(`${e.message}`);
        return false;
      }
    };

    const setup = async () => {
      const success = await setupAudioNodes();
      if (!success) {
        return;
      }
      
      // Продолжаем с остальной логикой
      continueSetup();
    };
    
    const continueSetup = () => {

    const canvas = canvasRef.current;
    if (!canvas) {
      setError("Canvas not found");
      return;
    }

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    function drawBars(ctx, data, canvas, isIdle = false) {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      if (isIdle) {
        drawBarsIdle(ctx, canvas);
        return;
      }
      if (!checkForAudioData(data)) {
        drawBarsIdle(ctx, canvas);
        return;
      }
      const barCount = 64;
      const barSpacing = 2;
      const availableWidth = canvas.width / dpr - (barCount * barSpacing);
      const barWidth = availableWidth / barCount;
      const dataStep = Math.floor(data.length / barCount);

      const themeColors = getThemeColors();
      const gradient = ctx.createLinearGradient(0, canvas.height / dpr, 0, 0);
      gradient.addColorStop(0, themeColors.visualizerGradient.barStart);
      gradient.addColorStop(0.3, themeColors.visualizerGradient.barEnd);
      gradient.addColorStop(0.6, themeColors.secondary);
      gradient.addColorStop(1, themeColors.tertiary);
      ctx.fillStyle = gradient;

      let maxValue = 0;
      for (let i = 0; i < barCount; i++) {
        const dataIndex = i * dataStep;
        if (dataIndex < data.length && data[dataIndex] > maxValue) {
          maxValue = data[dataIndex];
        }
      }
      maxValue = Math.max(maxValue, 1);
      for (let i = 0; i < barCount; i++) {
        const dataIndex = i * dataStep;
        if (dataIndex >= data.length) continue;
        const value = data[dataIndex] / 255;
        const scaledValue = Math.pow(value, 1.5);
        const barHeight = scaledValue * (canvas.height / dpr);
        const x = i * (barWidth + barSpacing);
        const y = (canvas.height / dpr) - barHeight;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, 0, 0]);
        ctx.fill();
      }
    }

    function drawBarsIdle(ctx, canvas) {
      const barCount = 64;
      const barSpacing = 2;
      const availableWidth = canvas.width / dpr - (barCount * barSpacing);
      const barWidth = availableWidth / barCount;
      const themeColors = getThemeColors();
      const gradient = ctx.createLinearGradient(0, canvas.height / dpr, 0, 0);
      gradient.addColorStop(0, themeColors.visualizerGradient.barStart);
      gradient.addColorStop(0.3, themeColors.visualizerGradient.barEnd);
      gradient.addColorStop(0.6, themeColors.secondary);
      gradient.addColorStop(1, themeColors.tertiary);
      ctx.fillStyle = gradient;
      animationCounterRef.current += 0.05;
      for (let i = 0; i < barCount; i++) {
        const phase = (i / barCount) * Math.PI * 4;
        const sin = Math.sin(phase + animationCounterRef.current);
        const barHeight = ((sin * 0.5) + 0.5) * 10;
        const x = i * (barWidth + barSpacing);
        const y = (canvas.height / dpr) - barHeight;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, 0, 0]);
        ctx.fill();
      }
    }

    function drawWave(ctx, data, canvas, isIdle = false) {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      if (isIdle) {
        drawWaveIdle(ctx, canvas);
        return;
      }
      if (!checkForAudioData(data, true)) {
        drawWaveIdle(ctx, canvas);
        return;
      }
      const center = (canvas.height / dpr) / 2;
      wavePhaseRef.current += 0.03;
      if (wavePhaseRef.current > Math.PI * 2) {
        wavePhaseRef.current = 0;
      }
      const themeColors = getThemeColors();

      // Используем сплошной цвет или градиент в зависимости от настроек
      if (themeColors.isGradientEnabled) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width / dpr, 0);
        gradient.addColorStop(0, themeColors.visualizerGradient.waveStart);
        gradient.addColorStop(1, themeColors.visualizerGradient.waveEnd);
        ctx.strokeStyle = gradient;
      } else {
        // Если градиент отключен, используем только базовый цвет
        ctx.strokeStyle = themeColors.visualizerGradient.waveStart;
      }

      ctx.lineWidth = 3;
      ctx.beginPath();
      const pointCount = 200;
      const dataStep = Math.floor(data.length / pointCount);
      let totalAmplitude = 0;
      for (let i = 0; i < data.length; i++) {
        totalAmplitude += Math.abs(data[i] - 128);
      }
      const avgAmplitude = totalAmplitude / data.length;
      const amplitudeScale = Math.min(1.0, avgAmplitude / 20);
      for (let i = 0; i < pointCount; i++) {
        const dataIndex = i * dataStep;
        if (dataIndex >= data.length) continue;
        const normalizedValue = (data[dataIndex] - 128) / 128.0;
        const angle = (i / pointCount) * Math.PI * 2;
        const dynamicOffset = Math.sin(angle + wavePhaseRef.current) * 0.3 * amplitudeScale;
        const finalValue = normalizedValue + dynamicOffset;
        const x = (i / pointCount) * (canvas.width / dpr);
        const y = center + finalValue * center * 0.7;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.globalAlpha = 0.2;
      for (let i = 0; i < pointCount; i++) {
        const dataIndex = i * dataStep;
        if (dataIndex >= data.length) continue;
        const normalizedValue = (data[dataIndex] - 128) / 128.0;
        const angle = (i / pointCount) * Math.PI * 2;
        const dynamicOffset = Math.sin(angle + wavePhaseRef.current) * 0.3 * amplitudeScale;
        const finalValue = normalizedValue + dynamicOffset;
        const x = (i / pointCount) * (canvas.width / dpr);
        const y = center - finalValue * center * 0.7;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;

    }

    function drawWaveIdle(ctx, canvas) {
      const center = (canvas.height / dpr) / 2;
      wavePhaseRef.current += 0.01;
      if (wavePhaseRef.current > Math.PI * 2) {
        wavePhaseRef.current = 0;
      }
      const themeColors = getThemeColors();

      // Используем сплошной цвет или градиент в зависимости от настроек
      if (themeColors.isGradientEnabled) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width / dpr, 0);
        gradient.addColorStop(0, themeColors.visualizerGradient.waveStart);
        gradient.addColorStop(1, themeColors.visualizerGradient.waveEnd);
        ctx.strokeStyle = gradient;
      } else {
        // Если градиент отключен, используем только базовый цвет
        ctx.strokeStyle = themeColors.visualizerGradient.waveStart;
      }

      ctx.lineWidth = 2;
      ctx.beginPath();
      const pointCount = 200;
      const waveHeight = 2;
      const waveFreq = 10;

      for (let i = 0; i < pointCount; i++) {
        const x = (i / pointCount) * (canvas.width / dpr);
        let y = center;
        const noiseAmount = 1.5;
        const microNoise = (Math.random() - 0.5) * noiseAmount;
        const periodicWave = Math.sin((i / pointCount) * Math.PI * waveFreq + wavePhaseRef.current) * waveHeight;
        y = center + microNoise + periodicWave;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

    }

    function drawWaveCentered(ctx, data, canvas, isIdle = false) {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      if (isIdle) {
        drawWaveCenteredIdle(ctx, canvas);
        return;
      }
      if (!checkForAudioData(data, true)) {
        drawWaveCenteredIdle(ctx, canvas);
        return;
      }
      const center = (canvas.height / dpr) / 2;
      const themeColors = getThemeColors();

      // Используем сплошной цвет или градиент в зависимости от настроек
      if (themeColors.isGradientEnabled) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width / dpr, 0);
        gradient.addColorStop(0, themeColors.visualizerGradient.waveStart);
        gradient.addColorStop(1, themeColors.visualizerGradient.waveEnd);
        ctx.strokeStyle = gradient;
      } else {
        // Если градиент отключен, используем только базовый цвет
        ctx.strokeStyle = themeColors.visualizerGradient.waveStart;
      }

      ctx.lineWidth = 3;
      ctx.beginPath();
      const pointCount = Math.min(data.length, 512);
      const dataStep = Math.floor(data.length / pointCount);
      let totalAmplitude = 0;
      for (let i = 0; i < data.length; i++) {
        totalAmplitude += Math.abs(data[i] - 128);
      }
      const avgAmplitude = totalAmplitude / data.length;
      const amplitudeScale = 1.0 + Math.min(0.5, avgAmplitude / 30);
      for (let i = 0; i < pointCount; i++) {
        const dataIndex = i * dataStep;
        if (dataIndex >= data.length) continue;
        const normalizedValue = (data[dataIndex] - 128) / 128.0;
        const scaledValue = normalizedValue * amplitudeScale;
        const x = (i / pointCount) * (canvas.width / dpr);
        const y = center + scaledValue * center * 0.7;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Базовая подсветка для центрированной волны
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = themeColors.visualizerGradient.waveStart;
      for (let i = 0; i < pointCount; i++) {
        const dataIndex = i * dataStep;
        if (dataIndex >= data.length) continue;
        const normalizedValue = (data[dataIndex] - 128) / 128.0;
        const scaledValue = normalizedValue * amplitudeScale;
        const x = (i / pointCount) * (canvas.width / dpr);
        const y = center + scaledValue * center * 0.7;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    function drawWaveCenteredIdle(ctx, canvas) {
      const center = (canvas.height / dpr) / 2;
      wavePhaseRef.current += 0.01;
      if (wavePhaseRef.current > Math.PI * 2) {
        wavePhaseRef.current = 0;
      }
      const themeColors = getThemeColors();
      const gradient = ctx.createLinearGradient(0, 0, canvas.width / dpr, 0);
      gradient.addColorStop(0, themeColors.visualizerGradient.waveStart);
      gradient.addColorStop(0.5, themeColors.visualizerGradient.waveEnd);
      gradient.addColorStop(1, themeColors.primary);
      ctx.lineWidth = 2;
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      const pointCount = 200;
      const waveHeight = 1.5;
      const waveFreq = 12;

      for (let i = 0; i < pointCount; i++) {
        const x = (i / pointCount) * (canvas.width / dpr);
        let y = center;
        const noiseAmount = 1.5;
        const microNoise = (Math.random() - 0.5) * noiseAmount;
        const periodicWave = Math.sin((i / pointCount) * Math.PI * waveFreq + wavePhaseRef.current) * waveHeight;
        y = center + microNoise + periodicWave;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.shadowBlur = 5;
      ctx.shadowColor = themeColors.visualizerGradient.waveStart;
      for (let i = 0; i < pointCount; i++) {
        const x = (i / pointCount) * (canvas.width / dpr);
        const noiseAmount = 1.5;
        const microNoise = (Math.random() - 0.5) * noiseAmount;
        const periodicWave = Math.sin((i / pointCount) * Math.PI * waveFreq + wavePhaseRef.current) * waveHeight;
        const y = center + microNoise + periodicWave;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    function drawCircle(ctx, freqData, timeData, canvas, isIdle = false) {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      if (isIdle) {
        drawCircleIdle(ctx, canvas);
        return;
      }
      let hasFreqData = checkForAudioData(freqData);
      let hasTimeData = checkForAudioData(timeData, true);
      if (!hasFreqData && !hasTimeData) {
        drawCircleIdle(ctx, canvas);
        return;
      }
      const centerX = (canvas.width / dpr) / 2;
      const centerY = (canvas.height / dpr) / 2;
      const baseRadius = Math.min(centerX, centerY) * 0.5;
      animationCounterRef.current += 0.005;
      if (animationCounterRef.current > Math.PI * 2) {
        animationCounterRef.current = 0;
      }
      const segments = 100;
      const angleStep = (Math.PI * 2) / segments;
      let totalAmplitude = 0;
      for (let i = 0; i < freqData.length; i++) {
        totalAmplitude += freqData[i];
      }
      const avgAmplitude = totalAmplitude / freqData.length;
      const intensityScale = Math.min(1.2, 0.5 + avgAmplitude / 128);
      const themeColors = getThemeColors();
      ctx.beginPath();
      const freqStep = Math.ceil(freqData.length / segments);
      for (let i = 0; i < segments; i++) {
        const freqIndex = (i * freqStep) % freqData.length;
        const freqValue = freqData[freqIndex] / 255.0;
        const radius = baseRadius * (1 + freqValue * 0.5 * intensityScale);
        const angle = i * angleStep + animationCounterRef.current;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      const gradient = ctx.createRadialGradient(
        centerX, centerY, baseRadius * 0.5,
        centerX, centerY, baseRadius * 1.5
      );
      gradient.addColorStop(0, themeColors.primary);
      gradient.addColorStop(0.5, themeColors.secondary);
      gradient.addColorStop(1, themeColors.tertiary);
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = themeColors.visualizerGradient.waveStart;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      if (hasTimeData) {
        ctx.beginPath();
        const timeStep = Math.ceil(timeData.length / segments);
        for (let i = 0; i < segments; i++) {
          const timeIndex = (i * timeStep) % timeData.length;
          const normalizedValue = (timeData[timeIndex] - 128) / 128.0;
          const innerBaseRadius = baseRadius * 0.4;
          const radius = innerBaseRadius * (1 + normalizedValue * 0.3);
          const angle = i * angleStep - animationCounterRef.current * 0.5;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        const innerGradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, baseRadius * 0.5
        );
        innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        innerGradient.addColorStop(0.7, 'rgba(232, 124, 255, 0.7)');
        innerGradient.addColorStop(1, 'rgba(181, 58, 212, 0.5)');
        ctx.fillStyle = innerGradient;
        ctx.fill();
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1.0;
    }

    function drawCircleIdle(ctx, canvas) {
      const centerX = (canvas.width / dpr) / 2;
      const centerY = (canvas.height / dpr) / 2;
      const baseRadius = Math.min(centerX, centerY) * 0.4;
      animationCounterRef.current += 0.01;
      ctx.beginPath();
      const segments = 80;
      const angleStep = (Math.PI * 2) / segments;
      const pulseAmount = Math.sin(animationCounterRef.current) * 0.05 + 1;
      const rotationSpeed = animationCounterRef.current * 0.2;
      for (let i = 0; i < segments; i++) {
        const angle = i * angleStep + rotationSpeed;
        const waveEffect = (Math.sin(angle * 6 + animationCounterRef.current) * 0.03) + 1;
        const radius = baseRadius * pulseAmount * waveEffect;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      const themeColors = getThemeColors();
      const gradient = ctx.createRadialGradient(
        centerX, centerY, baseRadius * 0.3,
        centerX, centerY, baseRadius * 1.2
      );
      gradient.addColorStop(0, themeColors.primary);
      gradient.addColorStop(0.6, themeColors.secondary);
      gradient.addColorStop(1, themeColors.tertiary);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = themeColors.visualizerGradient.waveStart;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      const innerRadius = baseRadius * 0.5;
      const innerRotation = -animationCounterRef.current * 0.1;
      for (let i = 0; i < segments; i++) {
        const angle = i * angleStep + innerRotation;
        const radius = innerRadius * (Math.sin(angle * 3 + animationCounterRef.current) * 0.05 + 0.95);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      const innerGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, innerRadius
      );
      innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      innerGradient.addColorStop(0.8, 'rgba(232, 124, 255, 0.4)');
      innerGradient.addColorStop(1, 'rgba(181, 58, 212, 0.2)');
      ctx.fillStyle = innerGradient;
      ctx.fill();
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();
    }

    function checkForAudioData(data, isTimeData = false) {
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
    }

    function isAudioPlaying() {
      const mainAudioPlaying = audioRef.current &&
        audioRef.current.src &&
        !audioRef.current.paused;
      const visualizerAudioPlaying = visualizerAudioElement &&
        visualizerAudioElement.src &&
        !visualizerAudioElement.paused;
      return mainAudioPlaying || visualizerAudioPlaying;
    }

    function draw() {
      animationIdRef.current = requestAnimationFrame(draw);
      if (!sharedAnalyser || !dataArrayRef.current || !timeDataArrayRef.current) {
        return;
      }
      const isPlaying = isAudioPlaying();
      const analyser = audioContextService.getAnalyser();
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArrayRef.current);
      analyser.getByteTimeDomainData(timeDataArrayRef.current);
      switch (currentType) {
        case VISUALIZER_TYPES.BARS:
          drawBars(ctx, dataArrayRef.current, canvas, !isPlaying);
          break;
        case VISUALIZER_TYPES.WAVE:
          drawWave(ctx, timeDataArrayRef.current, canvas, !isPlaying);
          break;
        case VISUALIZER_TYPES.WAVE_CENTERED:
          drawWaveCentered(ctx, timeDataArrayRef.current, canvas, !isPlaying);
          break;
        case VISUALIZER_TYPES.CIRCLE:
          drawCircle(ctx, dataArrayRef.current, timeDataArrayRef.current, canvas, !isPlaying);
          break;
        default:
          drawBars(ctx, dataArrayRef.current, canvas, !isPlaying);
      }
    }

    draw();
    setIsInitialized(true);
    setError(null);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (idleAnimationFrameRef.current) {
        cancelAnimationFrame(idleAnimationFrameRef.current);
      }
    };
    }; // Закрываем continueSetup
    
    setup(); // Вызываем setup
  }, [audioRef.current?.src, currentType, currentTrack]);

  useEffect(() => {
    if (visualizerAudioElement && currentTrack && currentTrack.isHls) {
      const mainAudioPlaying = audioRef.current && !audioRef.current.paused;
      if (mainAudioPlaying && visualizerAudioElement.paused) {
        visualizerAudioElement.play().catch(err => {
          console.warn('[Visualizer] Ошибка автозапуска:', err);
        });
      } else if (!mainAudioPlaying && !visualizerAudioElement.paused) {
        visualizerAudioElement.pause();
      }
      if (currentTrack.visualizerUrl && visualizerAudioElement.src !== currentTrack.visualizerUrl) {
        visualizerAudioElement.src = currentTrack.visualizerUrl;
        visualizerAudioElement.load();
        if (mainAudioPlaying) {
          visualizerAudioElement.play().catch(err => {
            console.warn('[Visualizer] Ошибка при загрузке нового URL:', err);
          });
        }
      }
    }

    return () => {
      if (visualizerAudioElement) {
        visualizerAudioElement.pause();
      }
    };
  }, [audioRef.current?.paused, currentTrack]);

  const handleSelectType = (type) => {
    setCurrentType(type);
    if (onChangeType) {
      onChangeType(type);
    }
    setShowMenu(false);
  };

  const handleCanvasClick = () => {
    setShowMenu(prevState => !prevState);
  };

  return (
    <div className="visualizer-container">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="audio-visualizer-canvas"
      />
      {showMenu && (
        <div className="visualizer-menu">
          {Object.entries(VISUALIZER_TYPES).map(([key, value]) => (
            <div
              key={value}
              className={`visualizer-menu-item ${currentType === value ? 'active' : ''}`}
              onClick={() => handleSelectType(value)}
            >
              {VISUALIZER_NAMES[value]}
            </div>
          ))}
        </div>
      )}
      <div className="visualizer-current-type">
        {VISUALIZER_NAMES[currentType]}
      </div>
    </div>
  );
}

AudioVisualizer.TYPES = VISUALIZER_TYPES;
AudioVisualizer.NAMES = VISUALIZER_NAMES;

export default AudioVisualizer;