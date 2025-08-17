import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Equalizer.css';
import audioContextService from '../services/audioContext';

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const EQ_PRESETS = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Pop': [-1, 2, 4, 4, 2, 0, -1, -1, -1, -1],
  'Rock': [3, 2, -2, -3, -1, 2, 4, 5, 5, 5],
  'Jazz': [2, 1, 1, 2, -2, -2, 0, 1, 2, 3],
  'Classical': [3, 2, -1, -1, -1, -1, -1, -2, 2, 3],
  'Electronic': [4, 3, 1, 0, -2, 2, 1, 1, 3, 4],
  'Hip Hop': [4, 3, 1, 2, -1, -1, 1, -1, 2, 3],
  'Vocal': [-2, -3, -2, 1, 3, 3, 2, 1, 0, -1],
  'Bass Boost': [6, 4, 3, 2, 1, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 2, 3, 4, 5]
};

const Equalizer = ({ 
  isOpen, 
  onClose, 
  audioRef, 
  onEqualizerChange 
}) => {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [gains, setGains] = useState(Array(10).fill(0));
  const [selectedPreset, setSelectedPreset] = useState('Flat');
  const [isEnabled, setIsEnabled] = useState(true);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  
  const equalizerRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Инициализация эквалайзера
  useEffect(() => {
    if (!audioRef?.current || !isOpen) {
      console.log('Equalizer: Missing audio ref or not open');
      return;
    }

    const initializeEqualizer = async () => {
      try {
        if (isInitializedRef.current) {
          console.log('Equalizer: Already initialized');
          return;
        }

        console.log('Equalizer: Starting initialization...');
        
        // Ожидаем немного, чтобы визуализатор проинициализировался первым
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Инициализируем аудио контекст
        await audioContextService.initialize(audioRef.current);
        
        // Проверяем, что сервис готов
        if (!audioContextService.isReady()) {
          throw new Error('Audio context service not ready');
        }
        
        // Создаем эквалайзер
        audioContextService.createEqualizer(EQ_FREQUENCIES, gains);
        
        isInitializedRef.current = true;
        console.log('Equalizer: Initialized successfully');
      } catch (error) {
        console.error('Equalizer: Failed to initialize:', error);
        isInitializedRef.current = false;
      }
    };

    // Попробуем инициализировать сразу
    initializeEqualizer();

    // И также по событиям
    const handleCanPlay = () => {
      if (!isInitializedRef.current) {
        console.log('Equalizer: Trying to initialize on canplay');
        initializeEqualizer();
      }
    };

    const handlePlay = () => {
      if (!isInitializedRef.current) {
        console.log('Equalizer: Trying to initialize on play');
        initializeEqualizer();
      }
    };

    audioRef.current.addEventListener('canplay', handleCanPlay);
    audioRef.current.addEventListener('play', handlePlay);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('canplay', handleCanPlay);
        audioRef.current.removeEventListener('play', handlePlay);
      }
    };
  }, [audioRef, isOpen]);

  // Применение настроек эквалайзера
  useEffect(() => {
    if (!isInitializedRef.current || !audioContextService.isReady()) {
      console.log('Equalizer: Not ready for gain updates yet');
      return;
    }

    console.log('Equalizer: Applying changes:', { gains, isEnabled });
    
    try {
      audioContextService.updateEqualizer(gains, isEnabled);
      
      if (onEqualizerChange) {
        onEqualizerChange({ gains, enabled: isEnabled });
      }
      
      console.log('Equalizer: Changes applied successfully');
    } catch (error) {
      console.error('Equalizer: Error updating:', error);
    }
  }, [gains, isEnabled, onEqualizerChange]);

  // Сохранение настроек в localStorage
  useEffect(() => {
    localStorage.setItem('equalizer_gains', JSON.stringify(gains));
    localStorage.setItem('equalizer_preset', selectedPreset);
    localStorage.setItem('equalizer_enabled', isEnabled.toString());
  }, [gains, selectedPreset, isEnabled]);

  // Загрузка настроек из localStorage
  useEffect(() => {
    const savedGains = localStorage.getItem('equalizer_gains');
    const savedPreset = localStorage.getItem('equalizer_preset');
    const savedEnabled = localStorage.getItem('equalizer_enabled');

    if (savedGains) {
      try {
        setGains(JSON.parse(savedGains));
      } catch (e) {
        console.error('Error parsing saved equalizer gains:', e);
      }
    }

    if (savedPreset && EQ_PRESETS[savedPreset]) {
      setSelectedPreset(savedPreset);
    }

    if (savedEnabled !== null) {
      setIsEnabled(savedEnabled === 'true');
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.equalizer-header-controls')) return;
    
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPresetDropdown && !event.target.closest('.eq-preset-dropdown')) {
        setShowPresetDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPresetDropdown]);

  const handleSliderChange = (index, value) => {
    const newGains = [...gains];
    newGains[index] = parseFloat(value);
    setGains(newGains);
    setSelectedPreset('Custom');
  };

  const handlePresetChange = (presetName) => {
    if (EQ_PRESETS[presetName]) {
      setGains([...EQ_PRESETS[presetName]]);
      setSelectedPreset(presetName);
    }
  };

  const resetEqualizer = () => {
    setGains(Array(10).fill(0));
    setSelectedPreset('Flat');
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={equalizerRef}
      className="equalizer-window"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
    >
      <div 
        className="equalizer-header"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
      >
        <h3>Эквалайзер</h3>
        <div className="equalizer-header-controls">
          <button 
            className={`eq-toggle ${isEnabled ? 'enabled' : 'disabled'}`}
            onClick={() => setIsEnabled(!isEnabled)}
          >
            {isEnabled ? 'ON' : 'OFF'}
          </button>
          <button className="eq-close" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="equalizer-content">
        <div className="eq-presets">
          <div className="eq-preset-dropdown">
            <div 
              className="eq-preset-selected"
              onClick={() => setShowPresetDropdown(!showPresetDropdown)}
            >
              <span>{selectedPreset}</span>
              <div className={`eq-preset-arrow ${showPresetDropdown ? 'open' : ''}`}>▼</div>
            </div>
            {showPresetDropdown && (
              <div className="eq-preset-options">
                {Object.keys(EQ_PRESETS).map(preset => (
                  <div
                    key={preset}
                    className={`eq-preset-option ${selectedPreset === preset ? 'active' : ''}`}
                    onClick={() => {
                      handlePresetChange(preset);
                      setShowPresetDropdown(false);
                    }}
                  >
                    {preset}
                  </div>
                ))}
                {!EQ_PRESETS[selectedPreset] && (
                  <div className="eq-preset-option active">
                    Custom
                  </div>
                )}
              </div>
            )}
          </div>
          <button className="eq-reset" onClick={resetEqualizer}>
            Сброс
          </button>
        </div>

        <div className="eq-sliders">
          <div className="eq-grid-lines">
            <div className="eq-grid-line gain-12"><span>+12dB</span></div>
            <div className="eq-grid-line gain-6"><span>+6dB</span></div>
            <div className="eq-grid-line gain-0"><span>0dB</span></div>
            <div className="eq-grid-line gain--6"><span>-6dB</span></div>
            <div className="eq-grid-line gain--12"><span>-12dB</span></div>
          </div>
          {EQ_FREQUENCIES.map((freq, index) => (
            <div key={freq} className="eq-band">
              <div className="eq-gain-value">
                {gains[index] > 0 ? '+' : ''}{gains[index].toFixed(1)}dB
              </div>
              <div className="eq-slider-wrapper">
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={gains[index]}
                  onChange={(e) => handleSliderChange(index, e.target.value)}
                  className="eq-slider-vertical"
                  disabled={!isEnabled}
                />
              </div>
              <div className="eq-frequency">
                {freq >= 1000 ? `${(freq/1000).toFixed(freq === 1000 ? 0 : 1)}k` : freq}Hz
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Equalizer;