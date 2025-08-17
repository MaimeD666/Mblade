import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import SearchTab from './components/Tabs/SearchTab';
import MainTab from './components/Tabs/MainTab';
import CollectionTab from './components/Tabs/CollectionTab';
import SettingsTab from './components/Tabs/SettingsTab';
import MusicPlayer from './components/MusicPlayer';
import SoundCloudClientIdModal from './components/SoundCloudClientIdModal';
import YouTubeAuthModal from './components/YouTubeAuthModal';
import WidgetManager from './services/WidgetManager';
import NotificationSystem, { getNotificationManager } from './components/NotificationSystem';
import Equalizer from './components/Equalizer';
import {
  searchAllPlatforms,
  getStreamUrl,
  getFastStreamUrl,
  loadPlaylistsFromServer,
  getSoundCloudClientId,
  saveSoundCloudClientId,
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
  checkSoundCloudTrackAvailability
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
  const [showClientIdModal, setShowClientIdModal] = useState(false);
  const [hasClientId, setHasClientId] = useState(true);
  const [showYouTubeAuthModal, setShowYouTubeAuthModal] = useState(false);
  const [hasYouTubeAuth, setHasYouTubeAuth] = useState(true);

  const [savedTracks, setSavedTracks] = useState([]);

  const [currentTrack, setCurrentTrackState] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('main');
  const [previousTab, setPreviousTab] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentScale, setCurrentScale] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [wasSearched, setWasSearched] = useState(false);

  const [likedTracks, setLikedTracks] = useState([]);
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
  const [isHorizontalMode, setIsHorizontalMode] = useState(false);

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

  const appRef = useRef(null);
  const audioRef = useRef(null);
  const syncTimeoutRef = useRef(null);

  // Функции для управления воспроизведением через Media Session
  const togglePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        mediaSessionService.updatePlaybackState(false);
      } else {
        audioRef.current.play().catch(err => {
          console.error('Ошибка воспроизведения:', err);
        });
        setIsPlaying(true);
        mediaSessionService.updatePlaybackState(true);
      }
    }
  }, [isPlaying]);

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

    const checkInitialSetup = async () => {
      try {
        const clientIdResult = await getSoundCloudClientId();
        setHasClientId(clientIdResult.is_set);
        
        const youtubeAuthStatus = await checkYouTubeAuthStatus();
        setHasYouTubeAuth(youtubeAuthStatus);

        if (!clientIdResult.is_set) {
          setShowClientIdModal(true);
        } else if (!youtubeAuthStatus) {
          setShowYouTubeAuthModal(true);
        }
      } catch (error) {
        console.error('Ошибка при проверке начальной настройки:', error);
        setHasClientId(false);
        setHasYouTubeAuth(false);
        setShowClientIdModal(true);
      }
    };

    checkInitialSetup();
  }, []);

  const handleClientIdSubmit = async (clientId) => {
    try {
      const result = await saveSoundCloudClientId(clientId);
      if (result.success) {
        setHasClientId(true);
        setShowClientIdModal(false);
        
        const youtubeAuthStatus = await checkYouTubeAuthStatus();
        if (!youtubeAuthStatus) {
          setShowYouTubeAuthModal(true);
        }
        
        return true;
      } else {
        throw new Error(result.error || 'Не удалось сохранить Client ID');
      }
    } catch (error) {
      console.error('Ошибка при сохранении Client ID:', error);
      throw error;
    }
  };

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
    
    // Инициализация горизонтального режима
    const horizontalMode = localStorage.getItem('horizontalMode') === 'true';
    setIsHorizontalMode(horizontalMode);
    if (horizontalMode) {
      document.documentElement.classList.add('horizontal-mode');
    }
    
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('keydown', handleKeyDown);
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
  }, [queue, queueIndex, queueSource, repeatMode, handlePlayTrack, customQueueActive, originalQueue, currentTrack]);

  const playPreviousTrack = useCallback(async () => {
    if (queue.length > 0 && queueIndex > 0) {
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
  }, [queue, queueIndex, queueSource, handlePlayTrack]);

  // Настройка Media Session API после определения всех callback функций
  useEffect(() => {
    mediaSessionService.setCallbacks({
      play: togglePlayPause,
      pause: togglePlayPause,
      nexttrack: playNextTrack,
      previoustrack: playPreviousTrack,
      stop: () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
        }
      },
      seekbackward: handleMediaSessionSeek,
      seekforward: (offset) => handleMediaSessionSeek(offset),
      seekto: handleMediaSessionSeekTo
    });
  }, [togglePlayPause, playNextTrack, playPreviousTrack, handleMediaSessionSeek, handleMediaSessionSeekTo]);

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
      }
      
    };

    const onPlaying = () => {
      setIsTrackLoading(false);
      setIsPlaying(true);
      mediaSessionService.updatePlaybackState(true);
    };

    const onWaiting = () => {
      setIsTrackLoading(true);
    };

    const onPause = () => {
      setIsPlaying(false);
      mediaSessionService.updatePlaybackState(false);
    };

    const onCanPlay = () => {
      setIsTrackLoading(false);
      if (isPlaying && audioElement && audioElement.paused) {
        audioElement.play().catch(err => {
          console.warn('Ошибка автовоспроизведения после canplay:', err);
          setIsPlaying(false);
        });
      }
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
            style={isHorizontalMode ? {
              // Вертикальная навигация в горизонтальном режиме
              left: '0',
              top: activeTab === 'main' ? '0' :
                activeTab === 'search' ? 'calc(25% + 3.75px)' :
                  activeTab === 'collection' ? 'calc(50% + 7.5px)' :
                    'calc(75% + 11.25px)'
            } : {
              // Горизонтальная навигация в обычном режиме
              left: activeTab === 'main' ? '0' :
                activeTab === 'search' ? 'calc(25% + 3.75px)' :
                  activeTab === 'collection' ? 'calc(50% + 7.5px)' :
                    'calc(75% + 11.25px)',
              top: '0'
            }}
          />

          <div
            className={getNavButtonClass('main')}
            onClick={() => setActiveTab('main')}
          >
            <div className="tab-button-content">
              <svg className="tab-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
              <span className="menu-text">Главная</span>
            </div>
          </div>

          <div
            className={getNavButtonClass('search')}
            onClick={() => setActiveTab('search')}
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

        <SoundCloudClientIdModal
          isOpen={showClientIdModal}
          onSubmit={handleClientIdSubmit}
          onCancel={() => {}}
        />

        <YouTubeAuthModal
          isOpen={showYouTubeAuthModal}
          onSuccess={handleYouTubeAuthSuccess}
          onError={handleYouTubeAuthError}
        />
      </div>
    </div>
  );
}

export default App;