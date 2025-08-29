import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import SearchTab from './components/Tabs/SearchTab';
import MainTab from './components/Tabs/MainTab';
import RecommendationsTab from './components/Tabs/RecommendationsTab';
import CollectionTab from './components/Tabs/CollectionTab';
import SettingsTab from './components/Tabs/SettingsTab';
// Импортируем плееры из папки components. Пути ориентированы на структуру вашего проекта.
import MusicPlayer from './components/MusicPlayer';
import HorizontalPlayer from './components/HorizontalPlayer';
import YouTubeAuthModal from './components/YouTubeAuthModal';
import WidgetManager from './services/WidgetManager';
import NotificationSystem, { getNotificationManager } from './components/NotificationSystem';
import Equalizer from './components/Equalizer';
import {
  searchAllPlatforms,
  getStreamUrl,
  getFastStreamUrl,
  loadPlaylistsFromServer,
  API_BASE_URL,
  setCurrentTrack,
  saveTrack,
  deleteSavedTrack,
  isTrackSaved,
  getSavedTracks,
  getCacheInfo,
  clearCache,
  preloadAdjacentTracks,
  handlePlaybackError,
  checkSoundCloudTrackAvailability,
  yandexWaveFeedback
} from './services/api';
import mediaSessionService from './services/mediaSession';


const REPEAT_MODES = {
  NONE: 'none',
  TRACK: 'track',
  PLAYLIST: 'playlist'
};

const safeLocalStorageSet = (key, value) => {
  try {
    const stringValue = JSON.stringify(value);
    const sizeInMB = new Blob([stringValue]).size / (1024 * 1024);

    if (sizeInMB > 4) {
      console.warn(`[Storage] Данные ${key} слишком большие (${sizeInMB.toFixed(2)}MB), сохраняем только на сервер`);
      return false;
    }

    localStorage.setItem(key, stringValue);
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn(`[Storage] localStorage переполнен, очищаем старые данные`);
      try {
        localStorage.clear();
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (retryError) {
        console.error(`[Storage] Не удалось сохранить ${key} даже после очистки:`, retryError);
        return false;
      }
    } else {
      console.error(`[Storage] Ошибка сохранения ${key}:`, error);
      return false;
    }
  }
};

const safeLocalStorageGet = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`[Storage] Ошибка чтения ${key}:`, error);
    return defaultValue;
  }
};

const clearGifsFromDB = () => {
  return new Promise((resolve, reject) => {
    const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

    if (!indexedDB) {
      resolve(true);
      return;
    }

    const request = indexedDB.open('MusicAppGifsDB', 1);

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['gifs'], 'readwrite');
      const store = transaction.objectStore('gifs');
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        resolve(true);
      };

      clearRequest.onerror = (event) => {
        console.error('Ошибка при очистке хранилища изображений:', event.target.error);
        reject(event.target.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    };

    request.onerror = (event) => {
      console.error('Ошибка при открытии IndexedDB:', event.target.error);
      resolve(true);
    };
  });
};

export const savePlaylistsToServer = async (playlists, likedTracks) => {
  const MAX_CHUNK_SIZE = 5 * 1024 * 1024;

  try {
    safeLocalStorageSet('playlists', playlists);
    safeLocalStorageSet('likedTracks', likedTracks);

    const fullData = { playlists, liked_tracks: likedTracks };
    const dataString = JSON.stringify(fullData);
    const dataSize = new Blob([dataString]).size;

    if (dataSize <= MAX_CHUNK_SIZE) {
      const response = await fetch(`${API_BASE_URL}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: dataString
      });

      if (!response.ok) {
        throw new Error(`Ошибка сохранения: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } else {
      const likedResponse = await fetch(`${API_BASE_URL}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playlists: [], liked_tracks: likedTracks })
      });

      if (!likedResponse.ok) {
        throw new Error(`Ошибка сохранения избранного: ${likedResponse.status} ${likedResponse.statusText}`);
      }

      const playlistGroups = [];
      let currentGroup = [];
      let currentSize = 0;

      for (const playlist of playlists) {
        const playlistStr = JSON.stringify(playlist);
        const playlistSize = new Blob([playlistStr]).size;

        if (playlistSize > MAX_CHUNK_SIZE) {
          const playlistBase = {
            id: playlist.id,
            name: playlist.name,
            tracks: []
          };

          if (currentSize + JSON.stringify(playlistBase).length > MAX_CHUNK_SIZE) {
            playlistGroups.push(currentGroup);
            currentGroup = [playlistBase];
            currentSize = JSON.stringify(playlistBase).length;
          } else {
            currentGroup.push(playlistBase);
            currentSize += JSON.stringify(playlistBase).length;
          }

          const trackChunks = [];
          let currentChunk = [];
          let currentChunkSize = 0;

          for (const track of playlist.tracks) {
            const trackStr = JSON.stringify(track);
            const trackSize = new Blob([trackStr]).size;

            if (currentChunkSize + trackSize > MAX_CHUNK_SIZE - 1000) {
              trackChunks.push(currentChunk);
              currentChunk = [track];
              currentChunkSize = trackSize;
            } else {
              currentChunk.push(track);
              currentChunkSize += trackSize;
            }
          }

          if (currentChunk.length > 0) {
            trackChunks.push(currentChunk);
          }

          for (let i = 0; i < trackChunks.length; i++) {
            const chunkData = {
              playlistId: playlist.id,
              trackChunk: trackChunks[i],
              chunkIndex: i,
              totalChunks: trackChunks.length
            };

            try {
              const trackChunkResponse = await fetch(`${API_BASE_URL}/playlists/track-chunk`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(chunkData)
              });

              if (!trackChunkResponse.ok) {
                console.warn(`Ошибка сохранения части треков ${i + 1}/${trackChunks.length} для плейлиста ${playlist.name}: ${trackChunkResponse.status}`);
              }
            } catch (err) {
              console.error(`Ошибка сохранения части треков ${i + 1}/${trackChunks.length} для плейлиста ${playlist.name}:`, err);
            }
          }
        } else {
          if (currentSize + playlistSize > MAX_CHUNK_SIZE) {
            playlistGroups.push(currentGroup);
            currentGroup = [playlist];
            currentSize = playlistSize;
          } else {
            currentGroup.push(playlist);
            currentSize += playlistSize;
          }
        }
      }

      if (currentGroup.length > 0) {
        playlistGroups.push(currentGroup);
      }

      for (let i = 0; i < playlistGroups.length; i++) {
        const group = playlistGroups[i];

        const groupData = {
          playlists: group,
          liked_tracks: [],
          group_index: i,
          total_groups: playlistGroups.length
        };

        try {
          const groupResponse = await fetch(`${API_BASE_URL}/playlists`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(groupData)
          });

          if (!groupResponse.ok) {
            console.warn(`Ошибка сохранения группы плейлистов ${i + 1}/${playlistGroups.length}: ${groupResponse.status}`);
          }
        } catch (err) {
          console.error(`Ошибка сохранения группы плейлистов ${i + 1}/${playlistGroups.length}:`, err);
        }
      }

      return { success: true, message: "Данные сохранены по частям" };
    }
  } catch (error) {
    console.error('Ошибка сохранения плейлистов на сервере:', error);
    return {
      success: false,
      error: error.message,
      message: "Данные сохранены в localStorage, но не на сервере"
    };
  }
};

function App() {
  const [showYouTubeAuthModal, setShowYouTubeAuthModal] = useState(false);
  const [hasYouTubeAuth, setHasYouTubeAuth] = useState(true);

  const [savedTracks, setSavedTracks] = useState([]);

  const [currentTrack, setCurrentTrackState] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('main');
  const [isMainRecommendations, setIsMainRecommendations] = useState(false);
  const [previousTab, setPreviousTab] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMainTransitioning, setIsMainTransitioning] = useState(false);
  const [currentScale, setCurrentScale] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [wasSearched, setWasSearched] = useState(false);

  const [likedTracks, setLikedTracks] = useState(() => {
    try {
      const saved = localStorage.getItem('likedTracks');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading liked tracks:', error);
      return [];
    }
  });
  const [playlists, setPlaylists] = useState([]);
  const [initLoaded, setInitLoaded] = useState(false);

  const [repeatMode, setRepeatMode] = useState(REPEAT_MODES.NONE);

  const [viewingPlaylist, setViewingPlaylist] = useState(null);
  const [viewingFavorites, setViewingFavorites] = useState(false);


  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueSource, setQueueSource] = useState(null);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);

  const [shuffleMode, setShuffleMode] = useState(false);
  const [originalQueue, setOriginalQueue] = useState([]);
  const [customQueueActive, setCustomQueueActive] = useState(false);
  // Состояние режима плеера: по умолчанию горизонтальный, если значение отсутствует в localStorage
  const [isHorizontalMode, setIsHorizontalMode] = useState(() => {
    try {
      const stored = localStorage.getItem('horizontalMode');
      if (stored === null) {
        return true;
      }
      return stored === 'true';
    } catch (e) {
      return false;
    }
  });

  const [visualizerType, setVisualizerType] = useState(localStorage.getItem('visualizerType') || 'wave_centered');
  const [visibleWidgets, setVisibleWidgets] = useState(WidgetManager.getInitialState());
  const [dbInitialized, setDbInitialized] = useState(false);

  // Настройки коллекции
  const [playlistViewType, setPlaylistViewType] = useState(localStorage.getItem('playlistViewType') || 'grid');
  const [trackViewType, setTrackViewType] = useState(localStorage.getItem('trackViewType') || 'default');
  const [favoritesPreviewEnabled, setFavoritesPreviewEnabled] = useState(
    localStorage.getItem('favoritesPreviewEnabled') === 'true'
  );

  // Эквалайзер
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);

  // Модальные окна горизонтального плеера
  const [showHorizontalPlaylistModal, setShowHorizontalPlaylistModal] = useState(false);
  const [showHorizontalOptionsModal, setShowHorizontalOptionsModal] = useState(false);
  const [showHorizontalShareModal, setShowHorizontalShareModal] = useState(false);
  const [horizontalShareUrl, setHorizontalShareUrl] = useState('');
  const [horizontalCopySuccess, setHorizontalCopySuccess] = useState(false);

  const appRef = useRef(null);
  const audioRef = useRef(null);
  const syncTimeoutRef = useRef(null);

  // Helper function to send Yandex Music feedback
  const sendYandexMusicFeedback = useCallback(async (track, feedbackType, playedSeconds = null, triggerNext = false) => {
    if (!track || track.platform !== 'yandex_music' || !track.queueSource?.includes('yandex_wave')) {
      return;
    }
    
    try {
      const trackDuration = track.duration || null;
      await yandexWaveFeedback(track.id, feedbackType, playedSeconds, trackDuration);
      if (playedSeconds !== null) {
        console.log(`[YM] Sent ${feedbackType} feedback for track ${track.id}, played ${playedSeconds.toFixed(1)}s`);
      } else {
        console.log(`[YM] Sent ${feedbackType} feedback for track ${track.id}`);
      }
      
      // Backoff delay после успешного feedback (300-600мс)
      const backoffDelay = 300 + Math.random() * 300;
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      // Trigger loadMoreWaveTracks if requested
      if (triggerNext && window.loadMoreWaveTracks) {
        console.log(`[YM] Triggering loadMoreWaveTracks after ${feedbackType} feedback with ${backoffDelay.toFixed(0)}ms backoff`);
        setTimeout(() => window.loadMoreWaveTracks(), 50); // Small additional delay to ensure UI is ready
      }
      
    } catch (error) {
      console.warn(`[YM] Failed to send ${feedbackType} feedback for track ${track.id}:`, error);
    }
  }, []);

  // Функции для управления воспроизведением через Media Session
  const playTrack = useCallback(() => {
    if (audioRef.current && !isPlaying) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        // Обновляем MediaSession после успешного воспроизведения
        setTimeout(() => mediaSessionService.updatePlaybackState(true), 0);
      }).catch(err => {
        console.error('Ошибка воспроизведения из MediaSession:', err);
        setIsPlaying(false);
        mediaSessionService.updatePlaybackState(false);
      });
    }
  }, [isPlaying]);

  const pauseTrack = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      // Обновляем MediaSession после паузы
      setTimeout(() => mediaSessionService.updatePlaybackState(false), 0);
    }
  }, [isPlaying]);

  const togglePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        pauseTrack();
      } else {
        playTrack();
      }
    }
  }, [isPlaying, playTrack, pauseTrack]);

  const handleMediaSessionSeek = useCallback((offset) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(audioRef.current.currentTime + offset, audioRef.current.duration || 0));
      audioRef.current.currentTime = newTime;
    }
  }, []);

  const handleMediaSessionSeekTo = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
    }
  }, []);


  // Обновление метаданных при смене трека
  useEffect(() => {
    if (currentTrack) {
      mediaSessionService.updateMetadata(currentTrack);
    }
  }, [currentTrack]);

  useEffect(() => {
    localStorage.setItem('visualizerType', visualizerType);
  }, [visualizerType]);


  useEffect(() => {
    WidgetManager.saveState(visibleWidgets);
  }, [visibleWidgets]);

  // Сохранение состояния рекомендаций в localStorage
  useEffect(() => {
    safeLocalStorageSet('isMainRecommendations', isMainRecommendations);
  }, [isMainRecommendations]);

  // Сохранение лайкнутых треков в localStorage
  useEffect(() => {
    try {
      localStorage.setItem('likedTracks', JSON.stringify(likedTracks));
    } catch (error) {
      console.error('Error saving liked tracks:', error);
    }
  }, [likedTracks]);

  // Загрузка состояния рекомендаций при инициализации
  useEffect(() => {
    const savedRecommendationsState = safeLocalStorageGet('isMainRecommendations', false);
    setIsMainRecommendations(savedRecommendationsState);
  }, []);

  // Функция для безопасного обновления плейлиста без прерывания воспроизведения
  useEffect(() => {
    window.updatePlaylistWithoutInterruption = (newTracks) => {
      console.log(`[App] Updating playlist without interruption: ${newTracks.length} tracks`);
      // Обновляем только queue без изменения currentTrack или позиции воспроизведения
      setQueue(newTracks);
    };

    // Экспорт функции togglePlayPause для использования кнопкой "Моя волна"
    window.togglePlayPause = togglePlayPause;

    // Очистка при размонтировании компонента
    return () => {
      window.updatePlaylistWithoutInterruption = null;
      window.togglePlayPause = null;
    };
  }, [togglePlayPause]);

  const toggleWidgetVisibility = (widgetId) => {
    setVisibleWidgets(prev => WidgetManager.toggleWidget(prev, widgetId));
  };

  // Обработчики настроек коллекции
  const handlePlaylistViewTypeChange = (viewType) => {
    setPlaylistViewType(viewType);
    localStorage.setItem('playlistViewType', viewType);
  };

  const handleTrackViewTypeChange = (viewType) => {
    setTrackViewType(viewType);
    localStorage.setItem('trackViewType', viewType);
  };

  const handleFavoritesPreviewToggle = () => {
    const newValue = !favoritesPreviewEnabled;
    setFavoritesPreviewEnabled(newValue);
    localStorage.setItem('favoritesPreviewEnabled', newValue.toString());
  };

  const shuffleQueue = (queue) => {
    const shuffledQueue = [...queue];
    for (let i = shuffledQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledQueue[i], shuffledQueue[j]] = [shuffledQueue[j], shuffledQueue[i]];
    }
    return shuffledQueue;
  };

  const toggleShuffleMode = () => {
    if (shuffleMode) {
      setShuffleMode(false);
      if (originalQueue.length > 0) {
        setQueue(originalQueue);
        if (currentTrack) {
          const index = originalQueue.findIndex(
            t => t.id === currentTrack.id && t.platform === currentTrack.platform
          );
          if (index !== -1) {
            setQueueIndex(index);

            setTimeout(() => {
              preloadAdjacentTracks(currentTrack, originalQueue, index)
                .catch(err => console.warn('Shuffle off preload error:', err));
            }, 500);
          }
        }
      }
    } else {
      setShuffleMode(true);
      setOriginalQueue(queue);
      if (currentTrack && queue.length > 0) {
        const currentTrackIndex = queue.findIndex(
          t => t.id === currentTrack.id && t.platform === currentTrack.platform
        );

        if (currentTrackIndex !== -1) {
          const queueWithoutCurrent = queue.filter((_, i) => i !== currentTrackIndex);
          const shuffledRest = shuffleQueue(queueWithoutCurrent);
          const newQueue = [queue[currentTrackIndex], ...shuffledRest];
          setQueue(newQueue);
          setQueueIndex(0);

          setTimeout(() => {
            preloadAdjacentTracks(currentTrack, newQueue, 0)
              .catch(err => console.warn('Shuffle on preload error:', err));
          }, 500);
        } else {
          const shuffledQueue = shuffleQueue(queue);
          setQueue(shuffledQueue);

          if (shuffledQueue.length > 0) {
            setTimeout(() => {
              preloadAdjacentTracks(null, shuffledQueue, -1)
                .catch(err => console.warn('Shuffle preload error:', err));
            }, 500);
          }
        }
      } else {
        const shuffledQueue = shuffleQueue(queue);
        setQueue(shuffledQueue);

        if (shuffledQueue.length > 0) {
          setTimeout(() => {
            preloadAdjacentTracks(null, shuffledQueue, -1)
              .catch(err => console.warn('Shuffle preload error:', err));
          }, 500);
        }
      }
    }
  };

  const playNext = (track) => {
    if (!track) return;

    let newQueue;
    let newQueueIndex = queueIndex;

    if (queue.length === 0 || queueIndex < 0) {
      newQueue = [track];
      setQueue(newQueue);
      setQueueIndex(0);
      setCustomQueueActive(true);
      newQueueIndex = 0;
    } else {
      if (!customQueueActive) {
        setCustomQueueActive(true);
        setOriginalQueue([...queue]);
      }

      newQueue = [...queue];
      newQueue.splice(queueIndex + 1, 0, track);
      setQueue(newQueue);
    }

    setTimeout(() => {
      preloadAdjacentTracks(currentTrack, newQueue, newQueueIndex)
        .catch(err => console.warn('PlayNext preload error:', err));
    }, 500);
  };

  const addToQueue = (track) => {
    if (!track) return;

    let newQueue;
    let newQueueIndex = queueIndex;

    if (queue.length === 0 || queueIndex < 0) {
      newQueue = [track];
      setQueue(newQueue);
      setQueueIndex(0);
      setCustomQueueActive(true);
      newQueueIndex = 0;
    } else {
      if (!customQueueActive) {
        setCustomQueueActive(true);
        setOriginalQueue([...queue]);
      }

      newQueue = [...queue, track];
      setQueue(newQueue);
    }

    setTimeout(() => {
      preloadAdjacentTracks(currentTrack, newQueue, newQueueIndex)
        .catch(err => console.warn('AddToQueue preload error:', err));
    }, 500);
  };

  const clearCustomQueue = () => {
    if (customQueueActive) {
      setCustomQueueActive(false);

      if (originalQueue.length > 0) {
        let newIndex = 0;
        if (currentTrack) {
          const index = originalQueue.findIndex(
            t => t.id === currentTrack.id && t.platform === currentTrack.platform
          );
          if (index !== -1) {
            newIndex = index;
          }
        }

        setQueue(originalQueue);
        setQueueIndex(newIndex);

        setTimeout(() => {
          preloadAdjacentTracks(currentTrack, originalQueue, newIndex)
            .catch(err => console.warn('Clear queue preload error:', err));
        }, 500);
      }
    }
  };

  const handlePlayTrack = async (
    track,
    source = null,
    sourceData = null,
    manualPlay = true
  ) => {
    if (currentTrack &&
      currentTrack.id === track.id &&
      currentTrack.platform === track.platform) {
      setIsPlaying(!isPlaying);
      if (audioRef.current) {
        if (isPlaying) audioRef.current.pause();
        else
          audioRef.current.play().catch((err) =>
            console.error("Ошибка воспроизведения:", err)
          );
      }
      return;
    }

    if (track.platform === "soundcloud") {
      setIsTrackLoading(true);
      try {
        const availability = await checkSoundCloudTrackAvailability(track.id);
        if (!availability.available) {
          setIsTrackLoading(false);
          getNotificationManager().showWarning(
            "SoundCloud: Трек недоступен",
            `"${track.title}" не может быть воспроизведен`,
            availability.error
          );
          return;
        }
      } catch (error) {
        console.error(
          "Ошибка проверки доступности SoundCloud трека:",
          error
        );
        setIsTrackLoading(false);
        return;
      }
    }

    let queueSourceType = source;
    let queueSourceData = sourceData;

    if (!queueSourceType) {
      if (viewingPlaylist) {
        queueSourceType = "playlist";
        queueSourceData = viewingPlaylist;
      } else if (viewingFavorites) {
        queueSourceType = "favorites";
        queueSourceData = likedTracks;
      } else if (activeTab === "search" && searchResults.length > 0) {
        queueSourceType = "search";
        queueSourceData = searchResults;
      }
    }

    const { newQueue, startIndex } = createQueue(
      track,
      queueSourceType,
      queueSourceData
    );
    const newTrack = newQueue[startIndex];

    setIsTrackLoading(true);

    try {
      setQueue(newQueue);
      setQueueIndex(startIndex);

      const queueSourceStr =
        queueSourceType === "playlist" && queueSourceData
          ? `playlist_${queueSourceData.id}`
          : queueSourceType;

      setQueueSource(queueSourceStr);

      await setCurrentTrack(newTrack);

      let streamUrl;
      if (newTrack.platform === "youtube") {
        try {
          streamUrl = await getFastStreamUrl(newTrack.id);
        } catch (err) {
          console.error("Ошибка получения YouTube URL:", err);
          streamUrl = getStreamUrl(newTrack);
        }
      } else {
        streamUrl = newTrack.streamUrl || getStreamUrl(newTrack);
      }

      setCurrentTrackState({
        ...newTrack,
        streamUrl,
        queueSource: queueSourceStr,
      });

      if (audioRef.current) {
        const setupAudio = () => {
          const a = audioRef.current;
          if (!a) return;

          a.oncanplay = () => setIsTrackLoading(false);
          a.onwaiting = () => setIsTrackLoading(true);
          a.onplaying = () => {
            setIsTrackLoading(false);
            setIsPlaying(true);
            // Send trackStarted feedback for Yandex Music wave tracks
            sendYandexMusicFeedback(newTrack, 'trackStarted');
          };
          a.onerror = (e) => {
            console.error(`[Audio] error: ${newTrack.id}`, e);
            setIsTrackLoading(false);
            setIsPlaying(false);
            if (newTrack.platform === "soundcloud") {
              handlePlaybackError(newTrack, {
                status: 404,
                user_message: "Ошибка воспроизведения аудиопотока",
              });
            } else {
              handlePlaybackError(newTrack, e);
            }
          };
          a.onloadstart = () => setIsTrackLoading(true);

          a.crossOrigin = "anonymous";
          a.preload = "auto";
          a.src = streamUrl;
          a.load();

          setTimeout(() => {
            if (audioRef.current && audioRef.current.src === streamUrl) {
              audioRef.current
                .play()
                .then(() => {
                  setIsPlaying(true);
                  setIsTrackLoading(false);
                  // Send trackStarted feedback for Yandex Music wave tracks
                  sendYandexMusicFeedback(newTrack, 'trackStarted');
                  setTimeout(
                    () =>
                      preloadAdjacentTracks(newTrack, newQueue, startIndex).catch(
                        (err) => console.warn("Preload error:", err)
                      ),
                    1000
                  );
                })
                .catch((err) => {
                  console.error(`[Audio] Play failed: ${newTrack.id}`, err);
                  setIsPlaying(false);
                  setIsTrackLoading(false);
                  if (newTrack.platform === "youtube") {
                    a.src = getStreamUrl(newTrack);
                    a.load();
                  }
                  handlePlaybackError(newTrack, err);
                });
            }
          }, 100);
        };
        setupAudio();
      }
    } catch (error) {
      console.error("Ошибка при подготовке трека:", error);
      setIsTrackLoading(false);
      setIsPlaying(false);
      handlePlaybackError(newTrack, error);
    }
  };

  const handleSyncTrack = async (syncTrack) => {
  if (false && syncTrack) {
    try {
      console.log('[Sync] Attempting to sync track:', syncTrack);
      
      if (currentTrack && 
          currentTrack.id === syncTrack.id && 
          currentTrack.platform === syncTrack.platform) {
        console.log('[Sync] Track already current, skipping sync');
        return;
      }

      setIsTrackLoading(true);

      const trackToPlay = {
        ...syncTrack,
        streamUrl: syncTrack.streamUrl || getStreamUrl(syncTrack)
      };

      setCurrentTrackState(trackToPlay);

      if (audioRef.current) {
        const setupSyncedAudio = () => {
          const a = audioRef.current;
          if (!a) return;

          a.oncanplay = () => {
            setIsTrackLoading(false);
            console.log('[Sync] Synced track ready to play');
          };
          
          a.onwaiting = () => setIsTrackLoading(true);
          
          a.onplaying = () => {
            setIsTrackLoading(false);
            setIsPlaying(true);
            console.log('[Sync] Synced track playing');
          };
          
          a.onerror = (e) => {
            console.error(`[Sync] Audio error for synced track: ${syncTrack.id}`, e);
            setIsTrackLoading(false);
            setIsPlaying(false);
            handlePlaybackError(trackToPlay, e);
          };
          
          a.onloadstart = () => setIsTrackLoading(true);

          a.crossOrigin = "anonymous";
          a.preload = "auto";
          a.src = trackToPlay.streamUrl;
          a.load();

          console.log('[Sync] Audio setup complete for synced track');
        };

        setupSyncedAudio();
      }

      await setCurrentTrack(trackToPlay);
      console.log('[Sync] Track sync completed');
    } catch (error) {
      console.error('[Sync] Error syncing track:', error);
      setIsTrackLoading(false);
      setIsPlaying(false);
    }
  }
};

const handleSyncPlayback = (syncIsPlaying, syncCurrentTime) => {
  if (false && audioRef.current) {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      try {
        const audio = audioRef.current;
        if (!audio) return;

        const currentAudioTime = audio.currentTime || 0;
        const timeDifference = Math.abs(currentAudioTime - syncCurrentTime);
        
        console.log(`[Sync] Playback sync - Current: ${currentAudioTime.toFixed(2)}s, Target: ${syncCurrentTime.toFixed(2)}s, Diff: ${timeDifference.toFixed(2)}s`);

        if (timeDifference > 2) {
          console.log('[Sync] Time difference significant, seeking to sync position');
          audio.currentTime = Math.max(0, syncCurrentTime);
          setCurrentPlaybackTime(syncCurrentTime);
        }

        if (syncIsPlaying && audio.paused) {
          console.log('[Sync] Starting playback to sync with host');
          audio.play().then(() => {
            setIsPlaying(true);
            console.log('[Sync] Playback started successfully');
          }).catch(err => {
            console.warn('[Sync] Failed to start playback:', err);
            setIsPlaying(false);
          });
        } else if (!syncIsPlaying && !audio.paused) {
          console.log('[Sync] Pausing playback to sync with host');
          audio.pause();
          setIsPlaying(false);
        }

        if (syncIsPlaying === isPlaying && timeDifference <= 2) {
          console.log('[Sync] Already in sync');
        }

      } catch (error) {
        console.error('[Sync] Error during playback sync:', error);
      }
    }, 100);
  }
};
  const checkYouTubeAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/youtube/auth-status`);
      const data = await response.json();
      return data.authenticated;
    } catch (error) {
      console.error('Ошибка при проверке YouTube авторизации:', error);
      return false;
    }
  };

  useEffect(() => {
    const loadDataWithRetry = async (retries = 3, delay = 2000) => {
      try {
        const saved = await getSavedTracks();
        if (saved?.saved_tracks) setSavedTracks(saved.saved_tracks);

        const data = await loadPlaylistsFromServer();
        if (data?.playlists) setPlaylists(data.playlists);
        if (data?.liked_tracks) setLikedTracks(data.liked_tracks);
        setInitLoaded(true);

        const storedTrack = safeLocalStorageGet('currentTrack');
        const storedPlaybackTime = safeLocalStorageGet('currentPlaybackTime');
        if (storedTrack) {
          try {
            setCurrentTrackState(storedTrack);

            if (storedTrack.queueSource) {
              setQueueSource(storedTrack.queueSource);
              if (storedTrack.queueSource.startsWith('playlist_')) {
                const playlistId = parseInt(storedTrack.queueSource.split('_')[1]);
                const playlist = data.playlists?.find(p => p.id === playlistId);
                if (playlist) {
                  const index = playlist.tracks.findIndex(t =>
                    t.id === storedTrack.id && t.platform === storedTrack.platform
                  );
                  if (index !== -1) {
                    setQueue(playlist.tracks);
                    setQueueIndex(index);
                  }
                }
              } else if (storedTrack.queueSource === 'favorites') {
                const likedTracksData = data.liked_tracks || [];
                const index = likedTracksData.findIndex(t =>
                  t.id === storedTrack.id && t.platform === storedTrack.platform
                );
                if (index !== -1) {
                  setQueue(likedTracksData);
                  setQueueIndex(index);
                }
              }
            }
            if (storedPlaybackTime) {
              const time = parseFloat(storedPlaybackTime);
              if (!isNaN(time)) {
                setCurrentPlaybackTime(time);
              }
            }
          } catch (e) {
            console.error('Ошибка при восстановлении трека:', e);
            localStorage.removeItem('currentTrack');
            localStorage.removeItem('currentPlaybackTime');
          }
        }

        setDbInitialized(true);
      } catch (err) {
        const storedPl = safeLocalStorageGet('playlists');
        const storedFav = safeLocalStorageGet('likedTracks');
        if (storedPl) setPlaylists(storedPl);
        if (storedFav) setLikedTracks(storedFav);
        setInitLoaded(true);
        setDbInitialized(true);

        if (retries) setTimeout(() => loadDataWithRetry(retries - 1, delay), delay);
      }
    };

    setTimeout(() => loadDataWithRetry(), 1500);

  }, []);


  const handleYouTubeAuthSuccess = () => {
    setHasYouTubeAuth(true);
    setShowYouTubeAuthModal(false);
    console.log('YouTube авторизация успешно завершена');
  };

  const handleYouTubeAuthError = (error) => {
    console.error('Ошибка авторизации YouTube:', error);
  };

  useEffect(() => {
    if (!initLoaded) return;

    safeLocalStorageSet('playlists', playlists);
    safeLocalStorageSet('likedTracks', likedTracks);

    const t = setTimeout(() => {
      savePlaylistsToServer(playlists, likedTracks)
        .catch(err => console.error('Ошибка сохранения на сервере:', err));
    }, 1000);

    return () => clearTimeout(t);
  }, [playlists, likedTracks, initLoaded]);

  useEffect(() => {
    if (currentTrack) {
      safeLocalStorageSet('currentTrack', currentTrack);
    }
  }, [currentTrack]);

  const updateScale = () => {
    if (!appRef.current) return;
    const targetWidth = 1920;
    const targetHeight = 1080;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const scaleX = windowWidth / targetWidth;
    const scaleY = windowHeight / targetHeight;
    const scale = Math.min(scaleX, scaleY);
    setCurrentScale(scale);
    const leftPosition = (windowWidth - (targetWidth * scale)) / 2;
    const topPosition = (windowHeight - (targetHeight * scale)) / 2;

    appRef.current.style.transform = `scale(${scale})`;
    appRef.current.style.position = 'absolute';
    appRef.current.style.left = `${leftPosition}px`;
    appRef.current.style.top = `${topPosition}px`;
    appRef.current.style.willChange = 'transform';
    appRef.current.style.transformOrigin = 'top left';
    appRef.current.style.imageRendering = 'high-quality';
  }

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    
    // Обработчик клавиши F11 для переключения полноэкранного режима
    const handleKeyDown = async (event) => {
      console.log('Key pressed:', event.key);
      if (event.key === 'F11') {
        console.log('F11 detected, preventing default and toggling fullscreen');
        event.preventDefault();
        
        try {
          // Сначала пробуем Tauri (для настольного приложения)
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            console.log('Calling toggle_fullscreen command');
            await invoke('toggle_fullscreen');
            console.log('toggle_fullscreen completed successfully');
            return;
          } catch (tauriError) {
            console.log('Tauri not available, using browser fullscreen API');
          }
          
          // Используем браузерный Fullscreen API
          if (!document.fullscreenElement) {
            console.log('Entering fullscreen mode');
            await document.documentElement.requestFullscreen();
            console.log('Entered fullscreen mode successfully');
          } else {
            console.log('Exiting fullscreen mode');
            await document.exitFullscreen();
            console.log('Exited fullscreen mode successfully');
          }
        } catch (error) {
          console.error('Failed to toggle fullscreen:', error);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Обработчик события storage для реакции на изменение режима плеера
    const handleStorageChange = (e) => {
      if (e.key === 'horizontalMode' || e.type === 'storage') {
        const storedValue = localStorage.getItem('horizontalMode');
        const newHorizontalMode = storedValue === 'true';
        setIsHorizontalMode(newHorizontalMode);
        
        if (newHorizontalMode) {
          document.documentElement.classList.add('horizontal-mode');
        } else {
          document.documentElement.classList.remove('horizontal-mode');
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Инициализация горизонтального режима
    // Определяем режим по умолчанию: если в localStorage нет записи,
    // то считаем, что режим должен быть горизонтальным (true).
    let storedHorizontal = localStorage.getItem('horizontalMode');
    let horizontalMode;
    if (storedHorizontal === null) {
      // При первом запуске значение отсутствует, задаём горизонтальный режим.
      horizontalMode = true;
      localStorage.setItem('horizontalMode', 'true');
    } else {
      horizontalMode = storedHorizontal === 'true';
    }
    setIsHorizontalMode(horizontalMode);
    if (horizontalMode) {
      document.documentElement.classList.add('horizontal-mode');
    }
    
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const createQueue = useCallback((track, source, sourceData) => {
    let newQueue = [];
    let startIndex = 0;

    if (customQueueActive) {
      setCustomQueueActive(false);
    }

    if (!sourceData && queue.length > 0) {
      const indexInCurrentQueue = queue.findIndex(t => t.id === track.id && t.platform === track.platform);
      if (indexInCurrentQueue !== -1) {
        setQueueIndex(indexInCurrentQueue);
        return { newQueue: queue, startIndex: indexInCurrentQueue };
      }
    }

    if (source === 'playlist' && sourceData) {
      newQueue = [...sourceData.tracks];
      startIndex = newQueue.findIndex(t => t.id === track.id && t.platform === track.platform);
    } else if (source === 'search' && sourceData && sourceData.length) {
      newQueue = [...sourceData];
      startIndex = newQueue.findIndex(t => t.id === track.id && t.platform === track.platform);
    } else if (source === 'favorites' && sourceData && sourceData.length) {
      newQueue = [...sourceData];
      startIndex = newQueue.findIndex(t => t.id === track.id && t.platform === track.platform);
    } else if (source === 'yandex_wave' && sourceData && sourceData.length) {
      console.log(`[Queue] Creating Yandex Wave queue with ${sourceData.length} tracks`);
      newQueue = [...sourceData];
      startIndex = newQueue.findIndex(t => t.id === track.id && t.platform === track.platform);
      console.log(`[Queue] Wave track index: ${startIndex}, track: ${track.title}`);
    } else {
      newQueue = [track];
      startIndex = 0;
    }

    if (startIndex === -1) {
      startIndex = 0;
      newQueue.unshift(track);
    }

    setOriginalQueue(newQueue);

    if (shuffleMode && newQueue.length > 1) {
      const currentTrack = newQueue[startIndex];
      const restTracks = newQueue.filter((_, i) => i !== startIndex);
      const shuffledRest = shuffleQueue(restTracks);
      newQueue = [currentTrack, ...shuffledRest];
      startIndex = 0;
    }

    return { newQueue, startIndex };
  }, [queue, customQueueActive, shuffleMode]);

  const playNextTrack = useCallback(async () => {
    // Send trackFinished feedback for current track before switching
    if (currentTrack && audioRef.current) {
      const playedSeconds = audioRef.current.currentTime || 0;
      sendYandexMusicFeedback(currentTrack, 'trackFinished', playedSeconds, true); // triggerNext = true
    }
    
    if (queue.length === 0) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    if (customQueueActive && queueIndex >= queue.length - 1) {
      if (originalQueue.length > 0) {
        let newIndex = 0;
        if (currentTrack) {
          const index = originalQueue.findIndex(
            t => t.id === currentTrack.id && t.platform === currentTrack.platform
          );

          if (index !== -1) {
            newIndex = index;
          }
        }

        setCustomQueueActive(false);
        setQueue(originalQueue);
        setQueueIndex(newIndex);

        if (newIndex < originalQueue.length - 1) {
          const nextIndex = newIndex + 1;
          const candidateTrack = originalQueue[nextIndex];
          setQueueIndex(nextIndex);
          handlePlayTrack(candidateTrack, queueSource, null, false);
          return;
        }
      }
    }

    if (queueIndex >= queue.length - 1 && repeatMode === REPEAT_MODES.PLAYLIST) {
      const firstTrack = queue[0];
      setQueueIndex(0);
      await handlePlayTrack(firstTrack, queueSource, null, false);
      return;
    }

    if (queueIndex < queue.length - 1) {
      const nextIndex = queueIndex + 1;
      const candidateTrack = queue[nextIndex];
      setQueueIndex(nextIndex);
      await handlePlayTrack(candidateTrack, queueSource, null, false);
      return;
    }

    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [queue, queueIndex, queueSource, repeatMode, handlePlayTrack, customQueueActive, originalQueue, currentTrack, sendYandexMusicFeedback]);

  const playPreviousTrack = useCallback(async () => {
    if (queue.length > 0 && queueIndex > 0) {
      // Send trackFinished feedback for current track before switching
      if (currentTrack && audioRef.current) {
        const playedSeconds = audioRef.current.currentTime || 0;
        sendYandexMusicFeedback(currentTrack, 'trackFinished', playedSeconds, true); // triggerNext = true
      }
      
      const prevIndex = queueIndex - 1;
      const candidateTrack = queue[prevIndex];
      setQueueIndex(prevIndex);
      await handlePlayTrack(candidateTrack, queueSource, null, false);
      return;
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => {
          console.error('Ошибка перезапуска трека:', err);
        });
      }
    }
  }, [queue, queueIndex, queueSource, handlePlayTrack, currentTrack, sendYandexMusicFeedback]);

  // Настройка Media Session API после определения всех callback функций
  useEffect(() => {
    mediaSessionService.setCallbacks({
      play: playTrack,
      pause: pauseTrack,
      nexttrack: playNextTrack,
      previoustrack: playPreviousTrack,
      stop: () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
          mediaSessionService.updatePlaybackState(false);
        }
      },
      seekbackward: handleMediaSessionSeek,
      seekforward: (offset) => handleMediaSessionSeek(offset),
      seekto: handleMediaSessionSeekTo
    });
  }, [playTrack, pauseTrack, playNextTrack, playPreviousTrack, handleMediaSessionSeek, handleMediaSessionSeekTo]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    audioElement.crossOrigin = "anonymous";
    audioElement.preload = "auto";

    const savePlaybackPosition = () => {
      const currentTime = audioElement.currentTime;
      if (currentTime > 0) {
        safeLocalStorageSet('currentPlaybackTime', currentTime.toString());
        setCurrentPlaybackTime(currentTime);
        // Обновляем позицию для Media Session
        if (audioElement.duration && isFinite(audioElement.duration)) {
          mediaSessionService.updatePositionState(audioElement.duration, 1.0, currentTime);
        }
      }
    };

    const onLoadedMetadata = () => {
      if (audioElement.duration && isFinite(audioElement.duration)) {
        setCurrentTrackState(prev => {
          if (prev) {
            return {
              ...prev,
              duration: audioElement.duration,
              actualDuration: audioElement.duration
            };
          }
          return prev;
        });
        // Обновляем позицию воспроизведения для Media Session
        mediaSessionService.updatePositionState(audioElement.duration, 1.0, audioElement.currentTime);
        
        // Периодическая синхронизация состояния для предотвращения рассинхрона
        if (Math.floor(audioElement.currentTime) % 10 === 0) {
          mediaSessionService.syncPlaybackState(audioElement);
        }
      }
      
    };

    const onPlaying = () => {
      setIsTrackLoading(false);
      if (!isPlaying) {
        setIsPlaying(true);
        // Обновляем MediaSession только если состояние изменилось
        setTimeout(() => mediaSessionService.updatePlaybackState(true), 0);
      }
    };

    const onWaiting = () => {
      setIsTrackLoading(true);
    };

    const onPause = () => {
      if (isPlaying) {
        setIsPlaying(false);
        // Обновляем MediaSession только если состояние изменилось
        setTimeout(() => mediaSessionService.updatePlaybackState(false), 0);
      }
    };

    const onCanPlay = () => {
      setIsTrackLoading(false);
      if (isPlaying && audioElement && audioElement.paused) {
        audioElement.play().catch(err => {
          console.warn('Ошибка автовоспроизведения после canplay:', err);
          setIsPlaying(false);
          mediaSessionService.updatePlaybackState(false);
        });
      }
      // Синхронизация при готовности к воспроизведению
      mediaSessionService.syncPlaybackState(audioElement);
    };

    const onEnded = () => {
      
      if (repeatMode === REPEAT_MODES.TRACK) {
        if (audioElement) {
          audioElement.currentTime = 0;
          audioElement.play().catch(err => console.error(err));
        }
      } else if (repeatMode === REPEAT_MODES.PLAYLIST) {
        playNextTrack();
      } else {
        if (queueIndex < queue.length - 1) playNextTrack();
      }
    };

    const playbackInterval = setInterval(savePlaybackPosition, 5000);

    audioElement.addEventListener('pause', savePlaybackPosition);
    audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
    audioElement.addEventListener('playing', onPlaying);
    audioElement.addEventListener('pause', onPause);
    audioElement.addEventListener('waiting', onWaiting);
    audioElement.addEventListener('canplay', onCanPlay);
    audioElement.addEventListener('ended', onEnded);

    const handlePlaybackErrorEvent = (error) => {
      console.error('Ошибка воспроизведения:', error);
      setIsTrackLoading(false);
      setIsPlaying(false);
    };

    audioElement.addEventListener('error', handlePlaybackErrorEvent);
    audioElement.addEventListener('loadstart', () => setIsTrackLoading(true));

    return () => {
      if (audioElement) {
        audioElement.removeEventListener('pause', savePlaybackPosition);
        audioElement.removeEventListener('loadedmetadata', onLoadedMetadata);
        audioElement.removeEventListener('playing', onPlaying);
        audioElement.removeEventListener('pause', onPause);
        audioElement.removeEventListener('waiting', onWaiting);
        audioElement.removeEventListener('canplay', onCanPlay);
        audioElement.removeEventListener('ended', onEnded);
        audioElement.removeEventListener('error', handlePlaybackErrorEvent);
        audioElement.removeEventListener('loadstart', () => setIsTrackLoading(true));
        clearInterval(playbackInterval);
        savePlaybackPosition();
      }
    };
  }, [isPlaying, queue, queueIndex, repeatMode, playNextTrack]);

  const handleQueryChange = (query) => {
    setSearchQuery(query);
  };

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setWasSearched(true);
    try {
      const results = await searchAllPlatforms(query);
      const allResults = [
        ...(results.youtube || []).map(item => ({
          ...item,
          platform: 'youtube',
          streamUrl: getStreamUrl(item)
        })),
        ...(results.soundcloud || []).map(item => ({
          ...item,
          platform: 'soundcloud',
          streamUrl: getStreamUrl(item)
        })),
        ...(results.yandex_music || []).map(item => ({
          ...item,
          platform: 'yandex_music',
          streamUrl: getStreamUrl(item)
        })),
        ...(results.vkmusic || []).map(item => ({
          ...item,
          platform: 'vkmusic',
          streamUrl: getStreamUrl(item)
        }))
      ];
      setSearchResults(allResults);
    } catch (error) {
      console.error('Ошибка поиска:', error);
      setSearchResults([]);
    } finally {
      setTimeout(() => setIsSearching(false), 800);
    }
  };

  const toggleLike = (track) => {
    if (!track) return;
    const lightTrack = {
      id: track.id,
      platform: track.platform,
      title: track.title,
      uploader: track.uploader,
      thumbnail: track.thumbnail,
      duration: track.duration || 0,
      streamUrl: track.streamUrl || getStreamUrl(track)
    };
    const isLiked = likedTracks.some(t => t.id === track.id && t.platform === track.platform);
    if (isLiked) {
      setLikedTracks(likedTracks.filter(t => !(t.id === track.id && t.platform === track.platform)));
    } else {
      setLikedTracks([lightTrack, ...likedTracks]);
    }
  };

  const isTrackLiked = (track) => {
    if (!track) return false;
    return likedTracks.some(t => t.id === track.id && t.platform === track.platform);
  };

  const createPlaylist = (name, track = null) => {
    let lightTrack = null;
    if (track) {
      lightTrack = {
        id: track.id,
        platform: track.platform,
        title: track.title,
        uploader: track.uploader,
        thumbnail: track.thumbnail,
        duration: track.duration || 0,
        streamUrl: track.streamUrl || getStreamUrl(track)
      };
    }
    const newPlaylist = {
      id: Date.now(),
      name: name.trim() || `Новый плейлист ${playlists.length + 1}`,
      tracks: lightTrack ? [lightTrack] : []
    };
    setPlaylists([newPlaylist, ...playlists]);
    return newPlaylist;
  };

  const deletePlaylist = (playlistId) => {
    setPlaylists(playlists.filter(p => p.id !== playlistId));
    if (viewingPlaylist && viewingPlaylist.id === playlistId) {
      setViewingPlaylist(null);
    }
  };

  const addTrackToPlaylist = (playlistId, track) => {
    if (!track) return;
    const lightTrack = {
      id: track.id,
      platform: track.platform,
      title: track.title,
      uploader: track.uploader,
      thumbnail: track.thumbnail,
      duration: track.duration || 0,
      streamUrl: track.streamUrl || getStreamUrl(track)
    };
    setPlaylists(playlists.map(playlist => {
      if (playlist.id === playlistId) {
        const trackExists = playlist.tracks.some(t => t.id === track.id && t.platform === track.platform);
        if (!trackExists) {
          return {
            ...playlist,
            tracks: [lightTrack, ...playlist.tracks]
          };
        }
      }
      return playlist;
    }));
  };

  const removeTrackFromPlaylist = (playlistId, trackId, platform) => {
    setPlaylists(playlists.map(playlist => {
      if (playlist.id === playlistId) {
        return {
          ...playlist,
          tracks: playlist.tracks.filter(t => !(t.id === trackId && t.platform === platform))
        };
      }
      return playlist;
    }));
    if (viewingPlaylist && viewingPlaylist.id === playlistId) {
      const updatedPlaylist = playlists.find(p => p.id === playlistId);
      if (updatedPlaylist) {
        setViewingPlaylist({
          ...updatedPlaylist,
          tracks: updatedPlaylist.tracks.filter(t => !(t.id === trackId && t.platform === platform))
        });
      }
    }
  };

  const viewPlaylist = (playlist) => {
    setViewingFavorites(false);
    setViewingPlaylist(playlist);
  };

  const exitPlaylistView = () => {
    setViewingPlaylist(null);
  };

  const viewFavorites = () => {
    setViewingPlaylist(null);
    setViewingFavorites(true);
  };

  const exitFavoritesView = () => {
    setViewingFavorites(false);
  };

  const addTrackToPlaylists = (track, playlistIds) => {
    if (!track || !playlistIds.length) return;
    const lightTrack = {
      id: track.id,
      platform: track.platform,
      title: track.title,
      uploader: track.uploader,
      thumbnail: track.thumbnail,
      duration: track.duration || 0,
      streamUrl: track.streamUrl || getStreamUrl(track)
    };
    setPlaylists(playlists.map(playlist => {
      if (playlistIds.includes(playlist.id)) {
        const trackExists = playlist.tracks.some(t => t.id === track.id && t.platform === track.platform);
        if (!trackExists) {
          return {
            ...playlist,
            tracks: [lightTrack, ...playlist.tracks]
          };
        }
      }
      return playlist;
    }));
  };

  const reorderPlaylists = (draggedIndex, targetIndex, position) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      console.log('Reorder cancelled: invalid indices', { draggedIndex, targetIndex });
      return;
    }

    console.log('Reordering playlists:', { draggedIndex, targetIndex, position });
    
    const updatedPlaylists = [...playlists];
    const [draggedPlaylist] = updatedPlaylists.splice(draggedIndex, 1);
    
    // Вычисляем новый индекс
    let newIndex = targetIndex;
    if (position === 'right') {
      newIndex = targetIndex + 1;
    }
    
    // Корректируем индекс при перемещении назад
    if (draggedIndex < newIndex) {
      newIndex--;
    }

    console.log('Final newIndex:', newIndex, 'Moving playlist:', draggedPlaylist.name);
    updatedPlaylists.splice(newIndex, 0, draggedPlaylist);
    setPlaylists(updatedPlaylists);
    
    // Сохраняем на сервер
    savePlaylistsToServer(updatedPlaylists, likedTracks);
  };

  // Функции для горизонтального плеера
  const handleHorizontalShareTrack = async () => {
    if (!currentTrack) return;

    let url = '';
    if (currentTrack.platform === 'youtube') {
      url = `https://www.youtube.com/watch?v=${currentTrack.id}`;
    } else if (currentTrack.platform === 'soundcloud') {
      url = currentTrack.url || '';

      if (!url) {
        try {
          const response = await fetch(`http://localhost:5000/api/soundcloud/get-track-info?id=${currentTrack.id}`);
          if (response.ok) {
            const trackInfo = await response.json();
            url = trackInfo.permalink_url || '';
          }
        } catch (error) {
          console.error('Ошибка получения информации о треке:', error);
        }
      }

      if (!url) {
        alert('Не удалось получить ссылку на этот трек');
        return;
      }
    } else if (currentTrack.url) {
      url = currentTrack.url;
    }

    if (!url) {
      alert('Ссылка на этот трек недоступна');
      return;
    }

    setHorizontalShareUrl(url);

    if (navigator.share && url) {
      navigator.share({
        title: currentTrack.title,
        text: `Послушай "${currentTrack.title}" от ${currentTrack.uploader}`,
        url: url
      })
        .then(() => console.log('Контент успешно отправлен'))
        .catch((error) => {
          console.log('Ошибка отправки:', error);
          setShowHorizontalShareModal(true);
        });
    } else {
      setShowHorizontalShareModal(true);
    }
  };

  const copyHorizontalToClipboard = () => {
    navigator.clipboard.writeText(horizontalShareUrl)
      .then(() => {
        setHorizontalCopySuccess(true);
        setTimeout(() => setHorizontalCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('Не удалось скопировать текст: ', err);
      });
  };

  const getTabClassName = (tabName) => {
    if (tabName === activeTab && !isTransitioning) {
      return 'tab-content tab-active';
    } else if (tabName === activeTab && isTransitioning) {
      return 'tab-content tab-entering';
    } else if (tabName === previousTab) {
      return 'tab-content tab-leaving';
    }
    return 'tab-content tab-hidden';
  };

  const getNavButtonClass = (tabName) => {
    return `${tabName}-menu-link ${activeTab === tabName ? 'active-tab-button' : ''}`;
  };

  return (
    <div className="frame">
      <div className="div" ref={appRef}>
        <NotificationSystem />
        {isHorizontalMode ? (
          <HorizontalPlayer
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            audioRef={audioRef}
            isLiked={isTrackLiked(currentTrack)}
            toggleLike={() => toggleLike(currentTrack)}
            playlists={playlists}
            createPlaylist={createPlaylist}
            addTrackToPlaylists={addTrackToPlaylists}
            onPrevTrack={playPreviousTrack}
            onNextTrack={playNextTrack}
            hasNext={queue.length > 0 && queueIndex < queue.length - 1}
            hasPrev={queue.length > 0 && queueIndex > 0}
            isLoading={isTrackLoading}
            repeatMode={repeatMode}
            setRepeatMode={setRepeatMode}
            shuffleMode={shuffleMode}
            toggleShuffleMode={toggleShuffleMode}
            isCustomQueueActive={customQueueActive}
            clearCustomQueue={clearCustomQueue}
            onSyncTrack={handleSyncTrack}
            onSyncPlayback={handleSyncPlayback}
            onOpenEqualizer={() => setIsEqualizerOpen(true)}
            onShowPlaylistModal={() => setShowHorizontalPlaylistModal(true)}
            onShowOptionsModal={() => setShowHorizontalOptionsModal(true)}
            onShowShareModal={() => setShowHorizontalShareModal(true)}
          />
        ) : (
          <MusicPlayer
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            audioRef={audioRef}
            isLiked={isTrackLiked(currentTrack)}
            toggleLike={() => toggleLike(currentTrack)}
            playlists={playlists}
            createPlaylist={createPlaylist}
            addTrackToPlaylists={addTrackToPlaylists}
            onPrevTrack={playPreviousTrack}
            onNextTrack={playNextTrack}
            hasNext={queue.length > 0 && queueIndex < queue.length - 1}
            hasPrev={queue.length > 0 && queueIndex > 0}
            isLoading={isTrackLoading}
            repeatMode={repeatMode}
            setRepeatMode={setRepeatMode}
            shuffleMode={shuffleMode}
            toggleShuffleMode={toggleShuffleMode}
            isCustomQueueActive={customQueueActive}
            clearCustomQueue={clearCustomQueue}
            onSyncTrack={handleSyncTrack}
            onSyncPlayback={handleSyncPlayback}
            onOpenEqualizer={() => setIsEqualizerOpen(true)}
          />
        )}

        <Equalizer
          isOpen={isEqualizerOpen}
          onClose={() => setIsEqualizerOpen(false)}
          audioRef={audioRef}
          onEqualizerChange={(settings) => {
            // Можно добавить логику для сохранения настроек эквалайзера
            console.log('Equalizer settings changed:', settings);
          }}
        />

        <div className="tabs-container">
          <div className={getTabClassName('search')}>
            <SearchTab
              onPlayTrack={(track) => handlePlayTrack(track, 'search', searchResults)}
              searchQuery={searchQuery}
              onQueryChange={handleQueryChange}
              onSearch={handleSearch}
              searchResults={searchResults}
              isSearching={isSearching}
              wasSearched={wasSearched}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              toggleLike={toggleLike}
              likedTracks={likedTracks}
              addTrackToPlaylist={addTrackToPlaylist}
              playlists={playlists}
              addTrackToPlaylists={addTrackToPlaylists}
              createPlaylist={createPlaylist}
              setPlaylists={setPlaylists}
              savePlaylistsToServer={savePlaylistsToServer}
            />
          </div>


          <div className={getTabClassName('main')}>
            <div 
              className={`main-content-wrapper ${isMainTransitioning ? 'transitioning' : ''}`}
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden'
              }}
            >
              <div 
                className={`main-tab-container ${isMainRecommendations ? 'slide-out-left' : 'slide-in-left'}`}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  top: 0,
                  left: 0
                }}
              >
                <MainTab
                  onPlayTrack={handlePlayTrack}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  audioRef={audioRef}
                  recentTracks={searchResults.length > 0 ? searchResults : likedTracks}
                  visualizerType={visualizerType}
                  setVisualizerType={setVisualizerType}
                  visibleWidgets={visibleWidgets}
                  toggleWidgetVisibility={toggleWidgetVisibility}
                />
              </div>
              
              <div 
                className={`recommendations-tab-container ${isMainRecommendations ? 'slide-in-right' : 'slide-out-right'}`}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  top: 0,
                  left: 0
                }}
              >
                <RecommendationsTab 
                  onPlayTrack={handlePlayTrack}
                  onNextTrack={playNextTrack}
                  toggleLike={toggleLike}
                  isTrackLiked={isTrackLiked}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  currentPlaylist={queue}
                  currentPlaylistType={queueSource}
                />
              </div>
            </div>
          </div>

          <div className={getTabClassName('collection')}>
            <CollectionTab
              onPlayTrack={(track) => {
                if (viewingPlaylist) {
                  handlePlayTrack(track, 'playlist', viewingPlaylist);
                } else if (viewingFavorites) {
                  handlePlayTrack(track, 'favorites', likedTracks);
                } else {
                  handlePlayTrack(track);
                }
              }}
              likedTracks={likedTracks}
              playlists={playlists}
              viewingPlaylist={viewingPlaylist}
              viewingFavorites={viewingFavorites}
              toggleLike={toggleLike}
              createPlaylist={createPlaylist}
              deletePlaylist={deletePlaylist}
              viewPlaylist={viewPlaylist}
              exitPlaylistView={exitPlaylistView}
              viewFavorites={viewFavorites}
              exitFavoritesView={exitFavoritesView}
              addTrackToPlaylist={addTrackToPlaylist}
              removeTrackFromPlaylist={removeTrackFromPlaylist}
              addTrackToPlaylists={addTrackToPlaylists}
              reorderPlaylists={reorderPlaylists}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              savePlaylistsToServer={savePlaylistsToServer}
              setPlaylists={setPlaylists}
              playNext={playNext}
              addToQueue={addToQueue}
              shuffleMode={shuffleMode}
              toggleShuffleMode={toggleShuffleMode}
              playlistViewType={playlistViewType}
              trackViewType={trackViewType}
              favoritesPreviewEnabled={favoritesPreviewEnabled}
            />
          </div>

          <div className={getTabClassName('settings')}>
            <SettingsTab
              visualizerType={visualizerType}
              setVisualizerType={setVisualizerType}
              visibleWidgets={visibleWidgets}
              toggleWidgetVisibility={toggleWidgetVisibility}
              clearGifsFromDB={clearGifsFromDB}
              dbInitialized={dbInitialized}
              playlistViewType={playlistViewType}
              onPlaylistViewTypeChange={handlePlaylistViewTypeChange}
              trackViewType={trackViewType}
              onTrackViewTypeChange={handleTrackViewTypeChange}
              favoritesPreviewEnabled={favoritesPreviewEnabled}
              onFavoritesPreviewToggle={handleFavoritesPreviewToggle}
            />
          </div>
        </div>

        <div className="screen-links">
          <div
            className="tab-indicator"
            style={{
              // РЕАЛЬНО ПРАВИЛЬНАЯ логика:
              // ВЕРТИКАЛЬНЫЙ режим плеера = кнопки навигации ГОРИЗОНТАЛЬНО = индикатор ездит по LEFT
              // ГОРИЗОНТАЛЬНЫЙ режим плеера = кнопки навигации ВЕРТИКАЛЬНО = индикатор ездит по TOP
              left: !isHorizontalMode ? (
                activeTab === 'main' ? '0px' :
                activeTab === 'search' ? 'calc(25% + 3.75px)' :
                  activeTab === 'collection' ? 'calc(50% + 7.5px)' :
                    'calc(75% + 11.25px)'
              ) : '0',
              top: !isHorizontalMode ? '0' : (
                activeTab === 'main' ? '0px' :
                activeTab === 'search' ? '256px' :
                  activeTab === 'collection' ? '513px' :
                    '770px'
              ),
              transform: 'none'
            }}
          />

          <div
            className={getNavButtonClass('main')}
            onClick={() => {
              if (activeTab === 'main') {
                // На главной вкладке - переключаем режимы
                setIsMainTransitioning(true);
                setTimeout(() => {
                  setIsMainRecommendations(!isMainRecommendations);
                  setTimeout(() => {
                    setIsMainTransitioning(false);
                  }, 50);
                }, 200);
              } else {
                // С других вкладок - просто переходим на главную БЕЗ изменения режима
                setActiveTab('main');
                // НЕ трогаем isMainRecommendations - оставляем как было
              }
            }}
          >
            <div className="tab-button-content">
              {activeTab !== 'main' ? (
                /* НЕ на главной - показываем текущий активный режим */
                isMainRecommendations ? (
                  <>
                    <svg className="tab-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="menu-text">Рекомендации</span>
                  </>
                ) : (
                  <>
                    <svg className="tab-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                    <span className="menu-text">Главная</span>
                  </>
                )
              ) : (
                /* НА главной - показываем кнопку для переключения (противоположный режим) */
                isMainRecommendations ? (
                  <>
                    <svg className="tab-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                    <span className="menu-text">Главная</span>
                  </>
                ) : (
                  <>
                    <svg className="tab-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="menu-text">Рекомендации</span>
                  </>
                )
              )}
            </div>
          </div>

          <div
            className={getNavButtonClass('search')}
            onClick={() => {
              setActiveTab('search');
              // Сброс состояния рекомендаций при переходе на другую вкладку не нужен, сохраняем
            }}
          >
            <div className="tab-button-content">
              <svg className="tab-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
              <span className="menu-text">Поиск</span>
            </div>
          </div>


          <div
            className={getNavButtonClass('collection')}
            onClick={() => setActiveTab('collection')}
          >
            <div className="tab-button-content">
              <svg className="tab-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z" />
              </svg>
              <span className="menu-text">Коллекция</span>
            </div>
          </div>

          <div
            className={getNavButtonClass('settings')}
            onClick={() => setActiveTab('settings')}
          >
            <div className="tab-button-content">
              <svg className="tab-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
              <span className="menu-text">Настройки</span>
            </div>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={currentTrack?.streamUrl || ''}
          autoPlay={false}
          style={{ display: 'none' }}
          crossOrigin="anonymous"
          preload="auto"
        />


        <YouTubeAuthModal
          isOpen={showYouTubeAuthModal}
          onSuccess={handleYouTubeAuthSuccess}
          onError={handleYouTubeAuthError}
        />

        {/* Модальные окна для горизонтального плеера */}
        {showHorizontalPlaylistModal && currentTrack && (
          <div className="modal-overlay add-to-playlist-modal">
            <div className="modal-content">
              <h3 className="modal-title">Добавить трек в плейлист</h3>
              <div className="create-new-playlist-option" onClick={() => {
                const name = prompt('Название плейлиста:');
                if (name?.trim()) {
                  createPlaylist(name, currentTrack);
                  setShowHorizontalPlaylistModal(false);
                }
              }}>
                <div className="create-new-playlist-icon">+</div>
                <div className="create-new-playlist-text">Создать новый плейлист</div>
              </div>

              {playlists.length > 0 ? (
                <div className="playlist-selection-list">
                  {playlists.map(playlist => (
                    <div
                      key={playlist.id}
                      className="playlist-selection-item"
                      onClick={() => {
                        addTrackToPlaylists(currentTrack, [playlist.id]);
                        setShowHorizontalPlaylistModal(false);
                      }}
                    >
                      <div className="playlist-selection-checkbox" />
                      <div className="playlist-selection-name">{playlist.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="modal-text">У вас еще нет плейлистов. Создайте новый!</p>
              )}

              <div className="modal-buttons">
                <div className="modal-button modal-button-cancel" onClick={() => setShowHorizontalPlaylistModal(false)}>
                  Отмена
                </div>
              </div>
            </div>
          </div>
        )}

        {showHorizontalOptionsModal && (
          <div className="modal-overlay options-modal">
            <div className="modal-content">
              <h3 className="modal-title">Дополнительные опции</h3>

              <div className="options-list">
                <div
                  className="option-item"
                  onClick={() => {
                    handleHorizontalShareTrack();
                    setShowHorizontalOptionsModal(false);
                  }}
                >
                  <div className="option-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" fill="#64e0ff" />
                    </svg>
                  </div>
                  <div className="option-text">
                    Поделиться треком
                  </div>
                </div>

                <div
                  className="option-item"
                  onClick={() => {
                    setIsEqualizerOpen(true);
                    setShowHorizontalOptionsModal(false);
                  }}
                >
                  <div className="option-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 6h2v8H7V6zm4-3h2v14h-2V3zm4 6h2v8h-2v-8z" fill="#64e0ff" />
                    </svg>
                  </div>
                  <div className="option-text">
                    Эквалайзер
                  </div>
                </div>

                {customQueueActive && (
                  <div
                    className="option-item"
                    onClick={() => {
                      clearCustomQueue();
                      setShowHorizontalOptionsModal(false);
                    }}
                  >
                    <div className="option-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 10h11v2H3v-2zm0-4h11v2H3V6zm0 8h7v2H3v-2zm13-1v8l6-4-6-4z" fill="#64e0ff" />
                      </svg>
                    </div>
                    <div className="option-text">
                      Вернуться к обычной очереди
                    </div>
                  </div>
                )}

                <div className="option-section-title">Режим повтора</div>

                <div
                  className={`option-item ${repeatMode === REPEAT_MODES.NONE ? 'active' : ''}`}
                  onClick={() => {
                    setRepeatMode(REPEAT_MODES.NONE);
                    setShowHorizontalOptionsModal(false);
                  }}
                >
                  <div className="option-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill={repeatMode === REPEAT_MODES.NONE ? "#64e0ff" : "white"} />
                    </svg>
                  </div>
                  <div className="option-text">Без повтора</div>
                </div>

                <div
                  className={`option-item ${repeatMode === REPEAT_MODES.TRACK ? 'active' : ''}`}
                  onClick={() => {
                    setRepeatMode(REPEAT_MODES.TRACK);
                    setShowHorizontalOptionsModal(false);
                  }}
                >
                  <div className="option-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill={repeatMode === REPEAT_MODES.TRACK ? "#64e0ff" : "white"} />
                      <circle cx="18" cy="18" r="6" fill="rgba(0,0,0,0.5)" />
                      <text x="18" y="21" textAnchor="middle" fontSize="8" fill={repeatMode === REPEAT_MODES.TRACK ? "#64e0ff" : "white"}>1</text>
                    </svg>
                  </div>
                  <div className="option-text">Повтор трека</div>
                </div>

                <div
                  className={`option-item ${repeatMode === REPEAT_MODES.PLAYLIST ? 'active' : ''}`}
                  onClick={() => {
                    setRepeatMode(REPEAT_MODES.PLAYLIST);
                    setShowHorizontalOptionsModal(false);
                  }}
                >
                  <div className="option-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill={repeatMode === REPEAT_MODES.PLAYLIST ? "#64e0ff" : "white"} />
                      <path d="M14 12l-3 0v-2l-4 3 4 3v-2h3v-2z" fill={repeatMode === REPEAT_MODES.PLAYLIST ? "#64e0ff" : "white"} fillOpacity="0.8" />
                    </svg>
                  </div>
                  <div className="option-text">Повтор плейлиста</div>
                </div>
              </div>

              <div className="modal-buttons">
                <div className="modal-button modal-button-confirm" onClick={() => setShowHorizontalOptionsModal(false)}>
                  Закрыть
                </div>
              </div>
            </div>
          </div>
        )}

        {showHorizontalShareModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3 className="modal-title">Поделиться треком</h3>
              <p className="modal-text">
                {currentTrack?.title && currentTrack?.uploader ?
                  `Поделитесь треком "${currentTrack.title}" от ${currentTrack.uploader}` :
                  'Поделитесь этим треком'}
              </p>

              <div className="share-link-container">
                <input
                  type="text"
                  value={horizontalShareUrl}
                  readOnly
                  className="playlist-name-input share-url-input"
                  onClick={(e) => e.target.select()}
                />
                <button
                  className={`share-copy-button ${horizontalCopySuccess ? 'success' : ''}`}
                  onClick={copyHorizontalToClipboard}
                >
                  {horizontalCopySuccess ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>

              <div className="share-options">
                <div className="share-option telegram" title="Поделиться в Telegram" onClick={() => {
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(horizontalShareUrl)}&text=${encodeURIComponent(`Послушай "${currentTrack?.title}" от ${currentTrack?.uploader}`)}`);
                }}>
                  <div className="share-option-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.38 15.84 14.22 15.51 15.99C15.37 16.74 15.09 16.99 14.83 17.02C14.25 17.07 13.81 16.64 13.25 16.27C12.37 15.69 11.87 15.33 11.02 14.77C10.03 14.12 10.67 13.76 11.24 13.18C11.39 13.03 13.95 10.7 14 10.49C14.0069 10.4582 14.006 10.4252 13.9973 10.3938C13.9886 10.3624 13.9724 10.3337 13.95 10.31C13.89 10.26 13.81 10.28 13.74 10.29C13.65 10.31 12.15 11.34 9.24 13.39C8.78 13.7 8.37 13.85 8 13.84C7.59 13.83 6.81 13.62 6.22 13.43C5.5 13.21 4.92 13.09 4.97 12.71C4.99 12.51 5.28 12.31 5.83 12.11C8.94 10.73 11.05 9.81 12.16 9.35C15.37 7.99 16.07 7.72 16.5 7.72C16.59 7.72 16.78 7.74 16.9 7.84C17 7.92 17.03 8.03 17.04 8.11C17.03 8.17 17.05 8.34 16.64 8.8Z" fill="#33a8e3" />
                    </svg>
                  </div>
                  <span>Telegram</span>
                </div>

                <div className="share-option whatsapp" title="Поделиться в WhatsApp" onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(`Послушай "${currentTrack?.title}" от ${currentTrack?.uploader}: ${horizontalShareUrl}`)}`);
                }}>
                  <div className="share-option-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.53 15.4C16.33 15.99 15.4 16.5 14.74 16.65C14.3 16.75 13.73 16.83 11.28 15.83C8.27 14.64 6.31 11.58 6.17 11.4C6.03 11.22 5 9.85 5 8.43C5 7.01 5.73 6.31 5.97 6.05C6.18 5.83 6.49 5.73 6.79 5.73C6.89 5.73 6.99 5.73 7.07 5.74C7.31 5.75 7.45 5.76 7.62 6.16C7.83 6.67 8.35 8.09 8.42 8.24C8.49 8.39 8.56 8.59 8.46 8.78C8.37 8.98 8.29 9.07 8.14 9.24C7.99 9.41 7.85 9.54 7.7 9.73C7.57 9.89 7.42 10.07 7.6 10.36C7.78 10.65 8.35 11.58 9.2 12.34C10.31 13.33 11.23 13.64 11.56 13.77C11.8 13.87 12.09 13.85 12.26 13.67C12.48 13.44 12.74 13.06 13.01 12.69C13.21 12.42 13.46 12.38 13.73 12.49C14.01 12.59 15.42 13.28 15.72 13.43C16.02 13.58 16.22 13.65 16.29 13.77C16.36 13.89 16.36 14.41 16.53 15.4Z" fill="#25d366" />
                    </svg>
                  </div>
                  <span>WhatsApp</span>
                </div>

                <div className="share-option vk" title="Поделиться ВКонтакте" onClick={() => {
                  window.open(`https://vk.com/share.php?url=${encodeURIComponent(horizontalShareUrl)}&title=${encodeURIComponent(currentTrack?.title)}&description=${encodeURIComponent(`Трек от ${currentTrack?.uploader}`)}`);
                }}>
                  <div className="share-option-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM17.24 14.26C17.24 14.26 18.23 15.24 18.47 15.65C18.48 15.66 18.48 15.67 18.49 15.67C18.58 15.82 18.6 15.94 18.55 16.03C18.47 16.2 18.14 16.3 18.04 16.3H16.38C16.26 16.3 16 16.28 15.69 16.07C15.45 15.91 15.21 15.64 14.98 15.38C14.63 14.99 14.33 14.66 14.03 14.66C14.002 14.6602 13.9739 14.6621 13.9464 14.6654C13.9189 14.6688 13.8923 14.6737 13.867 14.68C13.66 14.73 13.4 14.98 13.4 15.85C13.4 16.14 13.17 16.31 13.01 16.31H12.27C12.02 16.31 10.71 16.24 9.56 15.03C8.16 13.56 6.92 10.59 6.9 10.55C6.79 10.3 7 10.17 7.21 10.17H8.89C9.15 10.17 9.25 10.34 9.32 10.5C9.4 10.7 9.73 11.51 10.26 12.43C11.12 13.89 11.59 14.36 11.97 14.36C11.9947 14.3598 12.0191 14.3564 12.0428 14.3499C12.0665 14.3435 12.0893 14.334 12.11 14.32C12.43 14.15 12.36 12.86 12.34 12.52C12.34 12.49 12.34 11.86 12.13 11.57C11.97 11.36 11.70 11.29 11.55 11.26C11.61 11.18 11.68 11.12 11.76 11.08C12.07 10.93 12.62 10.91 13.17 10.91H13.47C14.07 10.92 14.21 10.96 14.41 11.01C14.81 11.12 14.81 11.39 14.75 12.14C14.73 12.39 14.71 12.67 14.71 13C14.71 13.08 14.7 13.17 14.7 13.26C14.68 13.71 14.66 14.23 14.93 14.42C14.9458 14.4302 14.9625 14.4375 14.98 14.44C15.05 14.44 15.28 14.44 15.97 12.45C16.24 11.79 16.47 11.03 16.48 10.98C16.5 10.92 16.53 10.83 16.63 10.77C16.7077 10.733 16.7937 10.7166 16.88 10.72H18.76C19 10.72 19.16 10.75 19.19 10.85C19.24 11.01 19.19 11.38 18.42 12.43L18.01 12.98C17.32 13.94 17.32 13.99 18.02 14.65C18.217 14.8346 18.4231 15.0261 18.64 15.24L17.24 14.26Z" fill="#4872a3" />
                    </svg>
                  </div>
                  <span>ВКонтакте</span>
                </div>
              </div>

              <div className="modal-buttons">
                <div className="modal-button modal-button-confirm" onClick={() => setShowHorizontalShareModal(false)}>
                  Закрыть
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;