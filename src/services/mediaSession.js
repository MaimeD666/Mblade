/**
 * Media Session API Service
 * Интеграция с системным медиа-плеером для Windows и Linux
 */

class MediaSessionService {
  constructor() {
    this.isSupported = 'mediaSession' in navigator;
    this.currentTrack = null;
    this.isPlaying = false;
    this.callbacks = {
      play: null,
      pause: null,
      previoustrack: null,
      nexttrack: null,
      stop: null,
      seekbackward: null,
      seekforward: null,
      seekto: null
    };

    if (this.isSupported) {
      console.log('[MediaSession] Media Session API поддерживается');
      this.setupMediaSession();
    } else {
      console.warn('[MediaSession] Media Session API не поддерживается в этом браузере');
    }
  }

  /**
   * Настройка Media Session API
   */
  setupMediaSession() {
    try {
      // Настраиваем обработчики действий
      navigator.mediaSession.setActionHandler('play', () => {
        console.log('[MediaSession] Play action triggered');
        if (this.callbacks.play) {
          this.callbacks.play();
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        console.log('[MediaSession] Pause action triggered');
        if (this.callbacks.pause) {
          this.callbacks.pause();
        }
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        console.log('[MediaSession] Previous track action triggered');
        if (this.callbacks.previoustrack) {
          this.callbacks.previoustrack();
        }
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        console.log('[MediaSession] Next track action triggered');
        if (this.callbacks.nexttrack) {
          this.callbacks.nexttrack();
        }
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        console.log('[MediaSession] Stop action triggered');
        if (this.callbacks.stop) {
          this.callbacks.stop();
        }
      });

      // Дополнительные действия для более точного управления
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        console.log('[MediaSession] Seek backward action triggered', details);
        if (this.callbacks.seekbackward) {
          this.callbacks.seekbackward(details.seekOffset || 10);
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        console.log('[MediaSession] Seek forward action triggered', details);
        if (this.callbacks.seekforward) {
          this.callbacks.seekforward(details.seekOffset || 10);
        }
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        console.log('[MediaSession] Seek to action triggered', details);
        if (this.callbacks.seekto) {
          this.callbacks.seekto(details.seekTime);
        }
      });

      console.log('[MediaSession] Обработчики действий настроены');
    } catch (error) {
      console.error('[MediaSession] Ошибка настройки Media Session:', error);
    }
  }

  /**
   * Регистрация callback функций для обработки медиа-событий
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    console.log('[MediaSession] Callbacks обновлены:', Object.keys(callbacks));
  }

  /**
   * Обновление метаданных трека
   */
  updateMetadata(track) {
    if (!this.isSupported || !track) {
      return;
    }

    try {
      const artwork = [];
      
      // Добавляем обложку трека если есть
      if (track.thumbnail) {
        // Разные размеры для лучшего отображения
        artwork.push(
          { src: track.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '192x192', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '384x384', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }
        );
      }

      const metadata = {
        title: track.title || 'Неизвестный трек',
        artist: track.uploader || track.artist || 'Неизвестный исполнитель',
        album: track.album || 'MBlade Music Player',
        artwork: artwork
      };

      navigator.mediaSession.metadata = new MediaMetadata(metadata);
      
      this.currentTrack = track;
      console.log('[MediaSession] Метаданные обновлены:', {
        title: metadata.title,
        artist: metadata.artist,
        hasArtwork: artwork.length > 0
      });
    } catch (error) {
      console.error('[MediaSession] Ошибка обновления метаданных:', error);
    }
  }

  /**
   * Обновление состояния воспроизведения
   */
  updatePlaybackState(isPlaying) {
    if (!this.isSupported) {
      return;
    }

    try {
      const newState = isPlaying ? 'playing' : 'paused';
      console.log('[MediaSession] Обновление состояния:', {
        old: navigator.mediaSession.playbackState,
        new: newState,
        isPlaying: isPlaying
      });
      
      // Принудительно обновляем состояние
      navigator.mediaSession.playbackState = newState;
      this.isPlaying = isPlaying;
      
      // Множественные попытки обновления для надежности
      const retryUpdate = () => {
        if (navigator.mediaSession.playbackState !== newState) {
          console.log('[MediaSession] Повторное обновление состояния:', newState);
          navigator.mediaSession.playbackState = newState;
        }
      };
      
      setTimeout(retryUpdate, 10);
      setTimeout(retryUpdate, 50);
      setTimeout(retryUpdate, 100);
      
    } catch (error) {
      console.error('[MediaSession] Ошибка обновления состояния воспроизведения:', error);
    }
  }

  /**
   * Синхронизация состояния с текущим состоянием воспроизведения
   */
  syncPlaybackState(audioElement) {
    if (!this.isSupported || !audioElement) {
      return;
    }

    try {
      const actualIsPlaying = !audioElement.paused;
      if (this.isPlaying !== actualIsPlaying) {
        navigator.mediaSession.playbackState = actualIsPlaying ? 'playing' : 'paused';
        this.isPlaying = actualIsPlaying;
        console.log('[MediaSession] Состояние синхронизировано с аудио элементом:', actualIsPlaying ? 'playing' : 'paused');
      }
    } catch (error) {
      console.error('[MediaSession] Ошибка синхронизации состояния:', error);
    }
  }

  /**
   * Обновление позиции воспроизведения
   */
  updatePositionState(duration, playbackRate = 1.0, position = 0) {
    if (!this.isSupported || !('setPositionState' in navigator.mediaSession)) {
      return;
    }

    try {
      if (duration && isFinite(duration) && duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: playbackRate,
          position: Math.min(position, duration)
        });
        console.log('[MediaSession] Позиция обновлена:', { duration, position, playbackRate });
      }
    } catch (error) {
      console.error('[MediaSession] Ошибка обновления позиции:', error);
    }
  }

  /**
   * Очистка Media Session
   */
  clear() {
    if (!this.isSupported) {
      return;
    }

    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      this.currentTrack = null;
      this.isPlaying = false;
      console.log('[MediaSession] Media Session очищен');
    } catch (error) {
      console.error('[MediaSession] Ошибка очистки Media Session:', error);
    }
  }

  /**
   * Получение текущего трека
   */
  getCurrentTrack() {
    return this.currentTrack;
  }

  /**
   * Проверка поддержки API
   */
  isApiSupported() {
    return this.isSupported;
  }
}

// Создаем единственный экземпляр сервиса
const mediaSessionService = new MediaSessionService();

export default mediaSessionService;