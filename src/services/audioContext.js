// Централизованное управление Web Audio API
class AudioContextService {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.analyser = null;
    this.equalizerNodes = [];
    this.isInitialized = false;
    this.audioElement = null;
  }

  async initialize(audioElement) {
    if (this.isInitialized && this.audioElement === audioElement && this.sourceNode) {
      console.log('AudioContextService: Already initialized for this element');
      return this.audioContext;
    }

    try {
      // Создаем контекст если его нет
      if (!this.audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          throw new Error("Web Audio API not supported");
        }
        this.audioContext = new AudioContext();
        console.log('AudioContextService: Created new AudioContext');
      }

      // Возобновляем контекст если приостановлен
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('AudioContextService: Resumed suspended context');
      }

      // Создаем analyser если его нет
      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        console.log('AudioContextService: Created analyser');
      }

      // Создаем source только если его еще нет или изменился элемент
      if (!this.sourceNode || this.audioElement !== audioElement) {
        try {
          // Отключаем старый source
          if (this.sourceNode) {
            this.sourceNode.disconnect();
            console.log('AudioContextService: Disconnected old source');
          }

          this.audioElement = audioElement;
          
          // Пытаемся создать новый source
          this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
          console.log('AudioContextService: Created new MediaElementSource');
          
        } catch (error) {
          if (error.name === 'InvalidStateError') {
            console.warn('AudioContextService: MediaElementSource already exists for this element');
            // Элемент уже подключен к другому контексту
            // Попробуем найти существующий source или пропустить
            this.isInitialized = true;
            return this.audioContext;
          } else {
            throw error;
          }
        }
      }

      // Подключаем аудио цепь
      this.reconnectAudioChain();
      
      this.isInitialized = true;
      console.log('AudioContextService: Initialization complete');
      return this.audioContext;
      
    } catch (error) {
      console.error('AudioContextService: Failed to initialize:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  // Создание эквалайзера
  createEqualizer(frequencies, gains) {
    if (!this.audioContext || !this.sourceNode) {
      throw new Error('Audio context not initialized');
    }

    // Удаляем существующие фильтры
    this.clearEqualizer();

    // Создаем новые фильтры
    this.equalizerNodes = frequencies.map((freq, index) => {
      const filter = this.audioContext.createBiquadFilter();
      
      if (index === 0) {
        filter.type = 'lowshelf';
        filter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
      } else if (index === frequencies.length - 1) {
        filter.type = 'highshelf';
        filter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
      } else {
        filter.type = 'peaking';
        filter.frequency.setValueAtTime(freq, this.audioContext.currentTime);
        filter.Q.setValueAtTime(1.414, this.audioContext.currentTime);
      }

      filter.gain.setValueAtTime(gains[index] || 0, this.audioContext.currentTime);
      return filter;
    });

    this.reconnectAudioChain();
    console.log(`AudioContextService: Created equalizer with ${this.equalizerNodes.length} bands`);
    
    return this.equalizerNodes;
  }

  // Обновление настроек эквалайзера
  updateEqualizer(gains, enabled = true) {
    if (!this.equalizerNodes.length || !this.audioContext) {
      console.warn('AudioContextService: No equalizer to update');
      return;
    }

    this.equalizerNodes.forEach((filter, index) => {
      try {
        const gainValue = enabled ? (gains[index] || 0) : 0;
        const currentTime = this.audioContext.currentTime;
        
        filter.gain.cancelScheduledValues(currentTime);
        filter.gain.setTargetAtTime(gainValue, currentTime, 0.01);
      } catch (error) {
        console.error(`AudioContextService: Error updating filter ${index}:`, error);
      }
    });

    console.log('AudioContextService: Updated equalizer gains');
  }

  // Очистка эквалайзера
  clearEqualizer() {
    this.equalizerNodes.forEach(filter => {
      try {
        filter.disconnect();
      } catch (e) {
        // Игнорируем ошибки отключения
      }
    });
    this.equalizerNodes = [];
  }

  // Переподключение аудио цепи
  reconnectAudioChain() {
    if (!this.sourceNode || !this.audioContext) {
      console.warn('AudioContextService: Cannot reconnect - missing source or context');
      return;
    }

    try {
      // Отключаем все соединения от source
      this.sourceNode.disconnect();
      
      let currentNode = this.sourceNode;

      // Подключаем эквалайзер если есть
      if (this.equalizerNodes.length > 0) {
        this.equalizerNodes.forEach((filter, index) => {
          currentNode.connect(filter);
          currentNode = filter;
          console.log(`AudioContextService: Connected EQ filter ${index}`);
        });
      }

      // Подключаем к analyser для визуализатора
      if (this.analyser) {
        currentNode.connect(this.analyser);
        console.log('AudioContextService: Connected to analyser');
      }

      // Подключаем к выходу
      currentNode.connect(this.audioContext.destination);
      console.log('AudioContextService: Connected to destination');

      console.log('AudioContextService: Audio chain reconnected successfully');
    } catch (error) {
      console.error('AudioContextService: Error reconnecting audio chain:', error);
    }
  }

  // Получение analyser для визуализатора
  getAnalyser() {
    return this.analyser;
  }

  // Получение контекста
  getContext() {
    return this.audioContext;
  }

  // Проверка инициализации
  isReady() {
    return this.isInitialized && this.audioContext && this.sourceNode;
  }

  // Очистка
  destroy() {
    this.clearEqualizer();
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
    this.audioElement = null;
    
    console.log('AudioContextService: Destroyed');
  }
}

// Экспортируем singleton
const audioContextService = new AudioContextService();
export default audioContextService;