import React, { useState, useEffect, useCallback, useRef } from 'react';
import './MainTab.css';
import AudioVisualizer from '../AudioVisualizer';
import WidgetManager from '../../services/WidgetManager';

const DEFAULT_GIF = "https://media.giphy.com/media/tqfS3mgQU28ko/giphy.gif";

const DB_CONFIG = {
  name: 'MusicAppGifsDB',
  version: 1,
  storeName: 'gifs',
  maxCount: 20
};

const STORAGE_KEYS = {
  TRACKS_PLAYED: 'stats_tracks_played',
  LISTENING_TIME: 'stats_listening_time',
  FAVORITE_TRACKS: 'stats_favorite_tracks',
  COMPLETED_TRACKS: 'stats_completed_tracks',
  WAVE_GLOW_ENABLED: 'visualizer_wave_glow_enabled',
  GLOW_INTENSITY: 'visualizer_glow_intensity',
  SELECTED_GIF: 'selected_gif'
};

const loveGradients = [
  'linear-gradient(135deg, #b53ad4, #e87cff)',
  'linear-gradient(135deg, #b53ad4, #ff7af5)',
  'linear-gradient(135deg, #cc3ad4, #ff7af5)',
  'linear-gradient(135deg, #e43ad4, #ff7af5)',
  'linear-gradient(135deg, #f13ad4, #ff7af5)',
  'linear-gradient(135deg, #ff3ad4, #ff7af5)',
  'linear-gradient(135deg, #ff3ab0, #ff7af5)',
  'linear-gradient(135deg, #ff3a82, #ff7af5)',
  'linear-gradient(135deg, #ff3a54, #ff7af5)',
  'linear-gradient(135deg, #ff3a3a, #fffc7a)'
];

const isWaveVisualizerType = (type) => {
  return type === AudioVisualizer.TYPES.WAVE || type === AudioVisualizer.TYPES.WAVE_CENTERED;
};

const GifSelectorMenu = ({ isOpen, gifs, onClose, onSelect, onAddNew, onDelete }) => {
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.includes('image/')) {
      alert('Пожалуйста, выберите изображение (GIF, JPG, PNG и т.д.)');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`Файл слишком большой (${(file.size / (1024 * 1024)).toFixed(2)} MB). Максимальный размер: 5 MB`);
      return;
    }

    try {
      const count = await countGifsInDB();
      if (count >= DB_CONFIG.maxCount && !file.isDefault) {
        if (window.confirm(`Вы достигли максимального количества изображений (${DB_CONFIG.maxCount}). Хотите заменить самое старое?`)) {
          const oldestGif = gifs
            .filter(gif => !gif.isDefault)
            .sort((a, b) => a.addedAt - b.addedAt)[0];

          if (oldestGif) {
            await deleteGifFromDB(oldestGif.id);
          } else {
            alert('Все текущие изображения являются дефолтными и не могут быть удалены');
            return;
          }
        } else {
          return;
        }
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target.result;
        onAddNew(dataUrl, file.name);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Ошибка при загрузке изображения:', error);
      alert('Не удалось загрузить изображение. Пожалуйста, попробуйте другой файл.');
    }
  };

  const handleClickOutside = (e) => {
    if (e.target.classList.contains('gif-selector-overlay')) {
      onClose();
    }
  };

  const handleDeleteGif = async (gif, e) => {
    e.stopPropagation();

    if (gif.isDefault) {
      alert('Нельзя удалить дефолтное изображение');
      return;
    }

    if (window.confirm(`Вы уверены, что хотите удалить изображение "${gif.name}"?`)) {
      onDelete(gif.id);
    }
  };

  return (
    <div className="gif-selector-overlay" onClick={handleClickOutside}>
      <div className="gif-selector-menu">
        <div className="gif-selector-header">
          <h3>Галерея изображений</h3>
          <div className="gif-add-button" onClick={() => fileInputRef.current.click()}>
            <span className="gif-add-icon">+</span>
            <span>Добавить изображение</span>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleFileSelect}
          />
        </div>

        <div className="gif-list-container">
          {gifs.length > 0 ? (
            <div className="gif-list">
              {gifs.map((gif) => (
                <div
                  key={gif.id}
                  className="gif-list-item"
                  onClick={() => onSelect(gif.id)}
                >
                  <div
                    className="gif-preview"
                    style={{ backgroundImage: `url(${gif.url})` }}
                  />
                  <div className="gif-item-footer">
                    <div className="gif-name">{gif.name}</div>
                    {!gif.isDefault && (
                      <div
                        className="gif-delete-button"
                        onClick={(e) => handleDeleteGif(gif, e)}
                        title="Удалить изображение"
                      >
                        ✕
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="gif-empty-message">
              У вас ещё нет добавленных изображений
              <div>Нажмите "Добавить изображение", чтобы загрузить своё первое изображение</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;

const initializeDB = () => {
  return new Promise((resolve, reject) => {
    if (!indexedDB) {
      reject('Ваш браузер не поддерживает IndexedDB. Изображения будут доступны только до перезагрузки страницы.');
      return;
    }

    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

    request.onerror = (event) => {
      console.error('Ошибка при открытии IndexedDB:', event.target.error);
      reject('Не удалось открыть базу данных IndexedDB.');
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
        db.createObjectStore(DB_CONFIG.storeName, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;

      db.onerror = (event) => {
        console.error('Ошибка базы данных:', event.target.error);
      };

      resolve(db);
    };
  });
};

const saveGifToDB = (gifData) => {
  return new Promise((resolve, reject) => {
    initializeDB()
      .then(db => {
        const transaction = db.transaction([DB_CONFIG.storeName], 'readwrite');
        const store = transaction.objectStore(DB_CONFIG.storeName);

        const request = store.add(gifData);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = (event) => {
          console.error('Ошибка при сохранении изображения:', event.target.error);
          reject(event.target.error);
        };

        transaction.oncomplete = () => {
          db.close();
        };
      })
      .catch(error => {
        console.error('Не удалось инициализировать IndexedDB:', error);
        reject(error);
      });
  });
};

const loadGifsFromDB = () => {
  return new Promise((resolve, reject) => {
    initializeDB()
      .then(db => {
        const transaction = db.transaction([DB_CONFIG.storeName], 'readonly');
        const store = transaction.objectStore(DB_CONFIG.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const gifs = request.result;
          resolve(gifs);
        };

        request.onerror = (event) => {
          console.error('Ошибка при загрузке изображений:', event.target.error);
          reject(event.target.error);
        };

        transaction.oncomplete = () => {
          db.close();
        };
      })
      .catch(error => {
        console.error('Не удалось инициализировать IndexedDB:', error);
        resolve([]);
      });
  });
};

const deleteGifFromDB = (id) => {
  return new Promise((resolve, reject) => {
    initializeDB()
      .then(db => {
        const transaction = db.transaction([DB_CONFIG.storeName], 'readwrite');
        const store = transaction.objectStore(DB_CONFIG.storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = (event) => {
          console.error('Ошибка при удалении изображения:', event.target.error);
          reject(event.target.error);
        };

        transaction.oncomplete = () => {
          db.close();
        };
      })
      .catch(error => {
        console.error('Не удалось инициализировать IndexedDB:', error);
        reject(error);
      });
  });
};

const countGifsInDB = () => {
  return new Promise((resolve, reject) => {
    initializeDB()
      .then(db => {
        const transaction = db.transaction([DB_CONFIG.storeName], 'readonly');
        const store = transaction.objectStore(DB_CONFIG.storeName);
        const request = store.count();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (event) => {
          console.error('Ошибка при подсчете изображений:', event.target.error);
          reject(event.target.error);
        };

        transaction.oncomplete = () => {
          db.close();
        };
      })
      .catch(error => {
        console.error('Не удалось инициализировать IndexedDB:', error);
        resolve(0);
      });
  });
};

const clearGifsFromDB = () => {
  return new Promise((resolve, reject) => {
    initializeDB()
      .then(db => {
        const transaction = db.transaction([DB_CONFIG.storeName], 'readwrite');
        const store = transaction.objectStore(DB_CONFIG.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = (event) => {
          console.error('Ошибка при очистке хранилища изображений:', event.target.error);
          reject(event.target.error);
        };

        transaction.oncomplete = () => {
          db.close();
        };
      })
      .catch(error => {
        console.error('Не удалось инициализировать IndexedDB:', error);
        reject(error);
      });
  });
};

// Исправленная функция форматирования времени
const formatListeningTime = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return "0:00";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

const updateTrackPlayed = (trackId, platform, trackInfo = null) => {
  try {
    const trackKey = `${platform}:${trackId}`;

    const completedTracks = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_TRACKS) || '{}');
    const now = Date.now();

    if (completedTracks[trackKey] && (now - completedTracks[trackKey]) < 10000) {
      return -1;
    }

    completedTracks[trackKey] = now;
    localStorage.setItem(STORAGE_KEYS.COMPLETED_TRACKS, JSON.stringify(completedTracks));

    const tracksPlayed = localStorage.getItem(STORAGE_KEYS.TRACKS_PLAYED) || '0';
    const count = parseInt(tracksPlayed) + 1;
    localStorage.setItem(STORAGE_KEYS.TRACKS_PLAYED, count.toString());

    const favoriteTracks = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITE_TRACKS) || '{}');

    if (!favoriteTracks[trackKey]) {
      favoriteTracks[trackKey] = {
        count: 0,
        lastPlayed: 0,
        thumbnail: trackInfo?.thumbnail || '',
        title: trackInfo?.title || trackId,
        artist: trackInfo?.uploader || platform
      };
    }

    favoriteTracks[trackKey].count += 1;
    favoriteTracks[trackKey].lastPlayed = now;

    if (trackInfo) {
      if (trackInfo.thumbnail) favoriteTracks[trackKey].thumbnail = trackInfo.thumbnail;
      if (trackInfo.title) favoriteTracks[trackKey].title = trackInfo.title;
      if (trackInfo.uploader) favoriteTracks[trackKey].artist = trackInfo.uploader;
    }

    localStorage.setItem(STORAGE_KEYS.FAVORITE_TRACKS, JSON.stringify(favoriteTracks));

    return count;
  } catch (error) {
    console.error('Ошибка при обновлении счетчика треков:', error);
    return parseInt(localStorage.getItem(STORAGE_KEYS.TRACKS_PLAYED) || '0');
  }
};

const getFavoriteTrack = (tracksList = []) => {
  try {
    const favoriteTracks = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITE_TRACKS) || '{}');

    if (Object.keys(favoriteTracks).length === 0) {
      return {
        title: "Выберите треки",
        artist: "для прослушивания",
        playCount: 0,
        loveLevel: 0,
        thumbnail: null
      };
    }

    let maxCount = 0;
    let favoriteTrackKey = '';

    Object.entries(favoriteTracks).forEach(([key, value]) => {
      if (value.count > maxCount) {
        maxCount = value.count;
        favoriteTrackKey = key;
      }
    });

    const loveLevel = Math.min(10, Math.floor(maxCount / 5) + (maxCount > 0 ? 1 : 0));

    const storedTrackData = favoriteTracks[favoriteTrackKey] || {};

    let trackData = null;
    if (favoriteTrackKey && tracksList.length > 0) {
      const [platform, id] = favoriteTrackKey.split(':');
      trackData = tracksList.find(t => t.platform === platform && t.id === id);
    }

    return {
      title: trackData?.title || storedTrackData.title || favoriteTrackKey.split(':')[1] || "Нет данных",
      artist: trackData?.uploader || storedTrackData.artist || favoriteTrackKey.split(':')[0] || "",
      playCount: maxCount,
      loveLevel: loveLevel,
      thumbnail: trackData?.thumbnail || storedTrackData.thumbnail || null
    };

  } catch (error) {
    console.error('Ошибка при получении любимого трека:', error);
    return {
      title: "Ошибка получения",
      artist: "данных",
      playCount: 0,
      loveLevel: 0,
      thumbnail: null
    };
  }
};

const MainTab = ({
  onPlayTrack,
  audioRef,
  currentTrack,
  isPlaying,
  recentTracks = [],
  visualizerType,
  setVisualizerType,
  visibleWidgets,
  toggleWidgetVisibility
}) => {
  const [customGifs, setCustomGifs] = useState([]);
  const [selectedGif, setSelectedGif] = useState(null);
  const [showGifSelector, setShowGifSelector] = useState(false);
  const [gifInteractionCount, setGifInteractionCount] = useState(0);
  const [dbInitialized, setDbInitialized] = useState(false);

  const [stats, setStats] = useState({
    tracksPlayed: 0,
    listeningSeconds: 0,
    favoriteTrack: {
      title: "Загрузка...",
      artist: "Загрузка...",
      playCount: 0,
      loveLevel: 0,
      thumbnail: null
    }
  });

  const playbackTimeRef = useRef(0);
  const listeningUpdateInterval = useRef(null);
  const lastUpdateTimeRef = useRef(Date.now());

  const { mainWidgetStyle, smallWidgetsStyles } = WidgetManager.getWidgetStyles(visibleWidgets);
  const bottomSectionStyle = WidgetManager.getBottomSectionStyle(visibleWidgets);
  const visibleSmallCount = WidgetManager.getVisibleSmallCount(visibleWidgets);

  useEffect(() => {
    const initDB = async () => {
      try {
        await initializeDB();
        setDbInitialized(true);

        const gifs = await loadGifsFromDB();

        const savedGifId = localStorage.getItem(STORAGE_KEYS.SELECTED_GIF);

        if (gifs.length === 0) {
          const defaultGif = {
            url: DEFAULT_GIF,
            name: "SpongeBob",
            isDefault: true,
            addedAt: Date.now()
          };

          const result = await saveGifToDB(defaultGif);
          if (result) {
            const updatedGifs = await loadGifsFromDB();
            setCustomGifs(updatedGifs);

            if (updatedGifs.length > 0) {
              const gifToSet = savedGifId && updatedGifs.some(gif => gif.id.toString() === savedGifId)
                ? parseInt(savedGifId)
                : updatedGifs[0].id;

              setSelectedGif(gifToSet);
              localStorage.setItem(STORAGE_KEYS.SELECTED_GIF, gifToSet.toString());
            }
          } else {
            setCustomGifs([defaultGif]);
          }
        } else {
          setCustomGifs(gifs);

          const gifToSet = savedGifId && gifs.some(gif => gif.id.toString() === savedGifId)
            ? parseInt(savedGifId)
            : gifs[0].id;

          setSelectedGif(gifToSet);
          localStorage.setItem(STORAGE_KEYS.SELECTED_GIF, gifToSet.toString());
        }
      } catch (error) {
        console.error('Ошибка при инициализации IndexedDB:', error);

        const defaultGif = {
          id: 0,
          url: DEFAULT_GIF,
          name: "SpongeBob (только память)",
          isDefault: true,
          addedAt: Date.now()
        };

        setCustomGifs([defaultGif]);
        setSelectedGif(0);
        localStorage.setItem(STORAGE_KEYS.SELECTED_GIF, "0");

        alert('Не удалось инициализировать хранилище для изображений. Изображения будут доступны только в текущей сессии.');
      }
    };

    initDB();
  }, []);

  const handleAddGif = async (dataUrl, name) => {
    try {
      const newGif = {
        url: dataUrl,
        name: name || `Изображение ${customGifs.length + 1}`,
        isDefault: false,
        addedAt: Date.now()
      };

      if (dbInitialized) {
        await saveGifToDB(newGif);

        const gifs = await loadGifsFromDB();
        setCustomGifs(gifs);

        if (gifs.length > 0) {
          const newGifId = gifs[gifs.length - 1].id;
          setSelectedGif(newGifId);
          localStorage.setItem(STORAGE_KEYS.SELECTED_GIF, newGifId.toString());
        }
      } else {
        newGif.id = Date.now();
        const updatedGifs = [...customGifs, newGif];
        setCustomGifs(updatedGifs);
        setSelectedGif(newGif.id);
        localStorage.setItem(STORAGE_KEYS.SELECTED_GIF, newGif.id.toString());
      }
    } catch (error) {
      console.error('Ошибка при добавлении изображения:', error);
      alert('Произошла ошибка при сохранении изображения. Изображение может быть доступно только до перезагрузки страницы.');

      const tempGif = {
        id: Date.now(),
        url: dataUrl,
        name: name || `Изображение ${customGifs.length + 1} (временное)`,
        isDefault: false,
        addedAt: Date.now(),
        temporary: true
      };

      const updatedGifs = [...customGifs, tempGif];
      setCustomGifs(updatedGifs);
      setSelectedGif(tempGif.id);
      localStorage.setItem(STORAGE_KEYS.SELECTED_GIF, tempGif.id.toString());
    }
  };

  const handleDeleteGif = async (gifId) => {
    try {
      const savedGifId = localStorage.getItem(STORAGE_KEYS.SELECTED_GIF);
      const isSelectedGif = savedGifId && parseInt(savedGifId) === gifId;

      if (dbInitialized) {
        await deleteGifFromDB(gifId);

        const gifs = await loadGifsFromDB();
        setCustomGifs(gifs);

        if (isSelectedGif && gifs.length > 0) {
          const newGifId = gifs[0].id;
          setSelectedGif(newGifId);
          localStorage.setItem(STORAGE_KEYS.SELECTED_GIF, newGifId.toString());
        }
      } else {
        const updatedGifs = customGifs.filter(gif => gif.id !== gifId);
        setCustomGifs(updatedGifs);

        if (isSelectedGif && updatedGifs.length > 0) {
          const newGifId = updatedGifs[0].id;
          setSelectedGif(newGifId);
          localStorage.setItem(STORAGE_KEYS.SELECTED_GIF, newGifId.toString());
        }
      }
    } catch (error) {
      console.error('Ошибка при удалении изображения:', error);
      alert('Произошла ошибка при удалении изображения.');
    }
  };

  const handleSelectGif = (gifId) => {
    setSelectedGif(gifId);
    localStorage.setItem(STORAGE_KEYS.SELECTED_GIF, gifId.toString());
    setShowGifSelector(false);
    setGifInteractionCount(prev => prev + 1);
  };

  const updateStats = useCallback(() => {
    const tracksPlayed = parseInt(localStorage.getItem(STORAGE_KEYS.TRACKS_PLAYED) || '0');
    const listeningSeconds = parseInt(localStorage.getItem(STORAGE_KEYS.LISTENING_TIME) || '0');
    const favoriteTrack = getFavoriteTrack(recentTracks);

    setStats({
      tracksPlayed,
      listeningSeconds,
      favoriteTrack
    });
  }, [recentTracks]);

  useEffect(() => {
    updateStats();

    const statsInterval = setInterval(() => {
      updateStats();
    }, 1000);

    return () => clearInterval(statsInterval);
  }, [updateStats]);

  useEffect(() => {
    const handleTrackEnd = () => {
      if (currentTrack) {
        const result = updateTrackPlayed(currentTrack.id, currentTrack.platform, currentTrack);
        updateStats();
      }
    };

    const audioElement = audioRef?.current;

    if (audioElement) {
      audioElement.addEventListener('ended', handleTrackEnd);

      return () => {
        if (audioElement) {
          audioElement.removeEventListener('ended', handleTrackEnd);
        }
      };
    }

    return () => { };
  }, [audioRef, currentTrack, updateStats]);

  useEffect(() => {
    const updatePlaybackTime = () => {
      if (audioRef?.current && !audioRef.current.paused) {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - lastUpdateTimeRef.current) / 1000);

        if (elapsedSeconds > 0) {
          const newTotalSeconds = updateListeningTime(elapsedSeconds);

          setStats(prevStats => ({
            ...prevStats,
            listeningSeconds: newTotalSeconds
          }));

          lastUpdateTimeRef.current = now;
        }
      }
    };

    if (isPlaying && audioRef?.current) {
      if (!listeningUpdateInterval.current) {
        lastUpdateTimeRef.current = Date.now();
      }

      if (listeningUpdateInterval.current) {
        clearInterval(listeningUpdateInterval.current);
      }

      listeningUpdateInterval.current = setInterval(updatePlaybackTime, 1000);
    } else if (listeningUpdateInterval.current) {
      clearInterval(listeningUpdateInterval.current);
      listeningUpdateInterval.current = null;
    }

    return () => {
      if (listeningUpdateInterval.current) {
        clearInterval(listeningUpdateInterval.current);
        listeningUpdateInterval.current = null;
      }
    };
  }, [isPlaying, audioRef]);

  const updateListeningTime = (seconds) => {
    try {
      const currentTime = parseInt(localStorage.getItem(STORAGE_KEYS.LISTENING_TIME) || '0');
      const newTime = currentTime + seconds;
      localStorage.setItem(STORAGE_KEYS.LISTENING_TIME, newTime.toString());
      return newTime;
    } catch (error) {
      console.error('Ошибка при обновлении времени прослушивания:', error);
      return parseInt(localStorage.getItem(STORAGE_KEYS.LISTENING_TIME) || '0');
    }
  };

  const handleGifClick = () => {
    setShowGifSelector(true);
  };

  const formattedListeningTime = formatListeningTime(stats.listeningSeconds);

  const getCurrentGif = () => {
    if (!customGifs.length) return DEFAULT_GIF;

    if (selectedGif === null && customGifs.length > 0) {
      return customGifs[0].url;
    }

    const foundGif = customGifs.find(gif => gif.id === selectedGif);
    return foundGif ? foundGif.url : DEFAULT_GIF;
  };

  const currentGifUrl = getCurrentGif();

  const statsWidgetsClassName = WidgetManager.getGridClassName(visibleWidgets);

  return (
    <div className="main-tab-wrapper">
      <div className="main-content-container">
        <div className={`main-content ${visibleSmallCount === 0 ? 'no-small-widgets' : ''}`}>
          <div className="top-section">
            <div
              className="main-visualizer-wrapper"
              style={mainWidgetStyle}
            >
              <AudioVisualizer
                audioRef={audioRef}
                visualizerType={visualizerType}
                onChangeType={setVisualizerType}
                currentTrack={currentTrack}
              />
            </div>
          </div>

          {visibleSmallCount > 0 && (
            <div className="bottom-section" style={bottomSectionStyle}>
              <div className={statsWidgetsClassName}>
                {visibleWidgets.tracksPlayed && (
                  <div
                    className="stat-widget widget"
                    style={smallWidgetsStyles.tracksPlayed || {}}
                  >
                    <div className="stat-title">Прослушано треков</div>
                    <div className="stat-circle">
                      <div className="stat-value">{stats.tracksPlayed}</div>
                    </div>
                    <div className="stat-label">Всего прослушанных треков</div>
                  </div>
                )}

                {visibleWidgets.listeningTime && (
                  <div
                    className="stat-widget widget"
                    style={smallWidgetsStyles.listeningTime || {}}
                  >
                    <div className="stat-title">Время прослушивания</div>
                    <div className="stat-circle">
                      <div className="stat-value time-value">{formattedListeningTime}</div>
                    </div>
                    <div className="stat-label">Общее время прослушивания</div>
                  </div>
                )}

                {visibleWidgets.favoriteTrack && (
                  <div
                    className="favorite-track-widget widget"
                    style={smallWidgetsStyles.favoriteTrack || {}}
                  >
                    <div className="stat-title">Любимый трек</div>
                    <div className="favorite-track-content">
                      <div className="favorite-track-icon">
                        {stats.favoriteTrack.thumbnail ? (
                          <img
                            src={stats.favoriteTrack.thumbnail}
                            alt="Обложка трека"
                            className="favorite-track-thumbnail"
                          />
                        ) : (
                          <div className="music-note-icon">♫</div>
                        )}
                      </div>
                      <div className="favorite-track-info">
                        <div className="favorite-track-name">{stats.favoriteTrack.title}</div>
                        <div className="favorite-track-artist">{stats.favoriteTrack.artist}</div>
                        <div className="favorite-track-plays">
                          {stats.favoriteTrack.playCount > 0 ? (
                            <>Прослушано {stats.favoriteTrack.playCount} раз</>
                          ) : (
                            <>Еще нет прослушиваний</>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {visibleWidgets.gifWidget && (
                  <div
                    className="gif-widget widget"
                    onClick={handleGifClick}
                    style={smallWidgetsStyles.gifWidget || {}}
                  >
                    <div className="gif-content">
                      <div
                        className="gif-background"
                        style={{ backgroundImage: `url(${currentGifUrl})` }}
                      />
                      {gifInteractionCount > 0 && (
                        <div className="gif-interaction-counter">
                          <span className="interaction-count">{gifInteractionCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <GifSelectorMenu
        isOpen={showGifSelector}
        gifs={customGifs}
        onClose={() => setShowGifSelector(false)}
        onSelect={handleSelectGif}
        onAddNew={handleAddGif}
        onDelete={handleDeleteGif}
      />
    </div>
  );
};

export default MainTab;