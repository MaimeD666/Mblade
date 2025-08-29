import React, { useState, useEffect, useRef } from 'react';
import './RecommendationsTab.css';
import { startYandexWave, getYandexRecommendations, yandexWaveFeedback } from '../../services/api';
import ScrambleText from '../ScrambleText';

const RecommendationsTab = ({ onPlayTrack, onNextTrack, toggleLike, isTrackLiked, currentTrack, isPlaying, currentPlaylist, currentPlaylistType }) => {
  const [activeTab, setActiveTab] = useState('yandex');
  const [hoveredTab, setHoveredTab] = useState(null);
  // Рабочая волна - то что сейчас играет
  const [activeWave, setActiveWave] = useState({
    tracks: [],
    currentSettings: null,
    isActive: false
  });
  
  // Панель рекомендаций - для просмотра и выбора треков  
  const [recommendationsData, setRecommendationsData] = useState({
    tracks: [],
    loading: false,
    error: null,
    stationInfo: null,
    isRefreshing: false // Для анимации обновления
  });
  
  const [waveSettings, setWaveSettings] = useState({
    mood: null, // cheerful, calm, sad, energetic или null
    character: null // favorite, unfamiliar, popular или null
  });
  const [isWavePlaying, setIsWavePlaying] = useState(false);
  const [waveLoading, setWaveLoading] = useState(false);
  const [isLoadingMoreTracks, setIsLoadingMoreTracks] = useState(false);
  const loadingRequestRef = useRef(null); // Для отслеживания активного запроса

  // Загрузка рекомендаций при монтировании компонента (БЕЗ зависимости от настроек волны)
  useEffect(() => {
    if (activeTab === 'yandex') {
      loadRecommendations();
    }
  }, [activeTab]);

  // Отслеживание проигрывается ли волна
  useEffect(() => {
    const isCurrentlyWavePlaying = currentPlaylistType === 'yandex_wave' && isPlaying;
    setIsWavePlaying(isCurrentlyWavePlaying);
    
    // Обновляем статус активной волны - волна активна если текущий плейлист это волна (независимо от паузы)
    const isWaveActive = currentPlaylistType === 'yandex_wave' && currentTrack;
    setActiveWave(prev => ({
      ...prev,
      isActive: isWaveActive
    }));
    
    console.log(`[Wave] Status update: isWavePlaying=${isCurrentlyWavePlaying}, isWaveActive=${isWaveActive}, playlistType=${currentPlaylistType}, hasWaveTracks=${activeWave.tracks.length > 0}`);
  }, [currentPlaylistType, isPlaying, currentTrack]);

  // Автозагрузка новых треков при приближении к концу активной волны
  useEffect(() => {
    console.log(`[Wave] Auto-check conditions: isWavePlaying=${isWavePlaying}, hasCurrentPlaylist=${!!currentPlaylist}, playlistType=${currentPlaylistType}, isLoadingMore=${isLoadingMoreTracks}`);
    
    if (isWavePlaying && currentPlaylist && currentPlaylistType === 'yandex_wave' && !isLoadingMoreTracks) {
      const currentIndex = currentPlaylist.findIndex(track => track.id === currentTrack?.id);
      const remainingTracks = currentPlaylist.length - currentIndex - 1;
      
      console.log(`[Wave] Auto-check: currentTrackId=${currentTrack?.id}, currentIndex=${currentIndex}, remainingTracks=${remainingTracks}, totalTracks=${currentPlaylist.length}`);
      
      // Если осталось 2 трека или меньше до конца, подгружаем новые
      if (remainingTracks <= 2 && remainingTracks >= 0 && currentIndex >= 0) {
        console.log('[Wave] Auto-loading more tracks...');
        loadMoreWaveTracks();
      } else {
        console.log(`[Wave] Auto-load conditions not met: remainingTracks=${remainingTracks}, currentIndex=${currentIndex}`);
      }
    } else {
      console.log(`[Wave] Auto-load skipped: isWavePlaying=${isWavePlaying}, hasPlaylist=${!!currentPlaylist}, playlistType=${currentPlaylistType}, loading=${isLoadingMoreTracks}`);
    }
  }, [isWavePlaying, currentTrack?.id, currentPlaylistType]); // УБРАЛИ currentPlaylist?.length и isLoadingMoreTracks

  // Загрузка рекомендаций (для панели просмотра) - НЕ запускает волну
  const loadRecommendations = async (isRefresh = false) => {
    if (isRefresh) {
      // При обновлении показываем анимацию на месте треков
      setRecommendationsData(prev => ({ ...prev, isRefreshing: true, error: null }));
    } else {
      // При первой загрузке показываем спиннер
      setRecommendationsData(prev => ({ ...prev, loading: true, error: null }));
    }
    
    // Загрузка в неблокирующем режиме
    setTimeout(async () => {
      try {
        const response = await getYandexRecommendations();
        if (response.success) {
          setRecommendationsData({
            tracks: response.tracks || [],
            loading: false,
            error: null,
            stationInfo: response.stationInfo || null,
            isRefreshing: false
          });
        } else {
          setRecommendationsData(prev => ({
            ...prev,
            loading: false,
            isRefreshing: false,
            error: response.error || 'Не удалось загрузить рекомендации'
          }));
        }
      } catch (error) {
        console.error('[Recommendations] Error loading recommendations:', error);
        setRecommendationsData(prev => ({
          ...prev,
          loading: false,
          isRefreshing: false,
          error: 'Ошибка подключения к серверу'
        }));
      }
    }, 0);
  };

  // Управление волной - запуск новой волны или пауза/возобновление текущей
  const startWaveDirectly = async (settings = waveSettings) => {
    // Если волна активна (загружена в плеер) - переключаем паузу/воспроизведение
    if (currentPlaylistType === 'yandex_wave' && currentTrack && activeWave.isActive) {
      console.log('[Wave] Toggling play/pause for current wave track');
      
      // Используем глобальные функции плеера для паузы/воспроизведения
      if (window.togglePlayPause) {
        window.togglePlayPause();
      } else {
        // Фолбэк: ищем аудио элемент и переключаем его состояние
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          if (audioElement.paused) {
            audioElement.play().catch(console.error);
          } else {
            audioElement.pause();
          }
        }
      }
      return;
    }
    
    // Если волна не играет - запускаем новую волну
    console.log('[Wave] Starting new wave...');
    setWaveLoading(true);
    
    // Запуск волны в неблокирующем режиме
    setTimeout(async () => {
      try {
        const response = await startYandexWave(settings);
        if (response.success && response.tracks && response.tracks.length > 0) {
          const newWave = {
            tracks: response.tracks,
            currentSettings: { ...settings },
            isActive: true // Волна будет активна, так как мы ее сразу запускаем
          };
          
          console.log(`[Wave] Got ${response.tracks.length} tracks for wave with settings:`, settings);
          setActiveWave(newWave);
          
          // Немедленно запускаем первый трек из волны в отдельном микротаске
          setTimeout(() => {
            console.log('[Wave] Starting first track:', response.tracks[0].title);
            onPlayTrack(response.tracks[0], 'yandex_wave', response.tracks);
          }, 0);
          
          setWaveLoading(false);
          return true;
        } else {
          console.error('[Wave] No tracks in wave response:', response);
          setWaveLoading(false);
          return false;
        }
      } catch (error) {
        console.error('[Wave] Error starting wave:', error);
        setWaveLoading(false);
        return false;
      }
    }, 0);
  };

  const handleWaveFeedback = async (trackId, type, isFromActiveWave = false) => {
    // Мгновенно обновляем локальное состояние трека для UI
    if (isFromActiveWave) {
      setActiveWave(prev => ({
        ...prev,
        tracks: prev.tracks.map(track => {
          if (track.id === trackId) {
            return {
              ...track,
              feedback: type === 'skip' ? null : type
            };
          }
          return track;
        })
      }));
    } else {
      setRecommendationsData(prev => ({
        ...prev,
        tracks: prev.tracks.map(track => {
          if (track.id === trackId) {
            return {
              ...track,
              feedback: type === 'skip' ? null : type
            };
          }
          return track;
        })
      }));
    }
    
    // Отправляем фидбек в фоновом режиме
    try {
      await yandexWaveFeedback(trackId, type);
    } catch (error) {
      console.error('[Recommendations] Feedback error:', error);
      // При ошибке откатываем изменения
      if (isFromActiveWave) {
        setActiveWave(prev => ({
          ...prev,
          tracks: prev.tracks.map(track => {
            if (track.id === trackId) {
              return {
                ...track,
                feedback: null // Сбрасываем feedback при ошибке
              };
            }
            return track;
          })
        }));
      } else {
        setRecommendationsData(prev => ({
          ...prev,
          tracks: prev.tracks.map(track => {
            if (track.id === trackId) {
              return {
                ...track,
                feedback: null // Сбрасываем feedback при ошибке
              };
            }
            return track;
          })
        }));
      }
    }
  };

  const handleTrackPlay = (track, isFromActiveWave = false) => {
    if (onPlayTrack) {
      const tracklist = isFromActiveWave ? activeWave.tracks : recommendationsData.tracks;
      // Рекомендации воспроизводятся как обычный плейлист, НЕ как волна
      const playlistType = isFromActiveWave ? 'yandex_wave' : 'yandex_recommendations';
      onPlayTrack(track, playlistType, tracklist);
    }
  };

  const loadMoreWaveTracks = async () => {
    // Проверка дублирования через ref
    if (loadingRequestRef.current) {
      console.log('[Wave] Request already in progress, skipping...');
      return;
    }
    
    if (isLoadingMoreTracks) {
      console.log('[Wave] Already loading more tracks, skipping...');
      return;
    }
    
    // Дополнительная проверка - не загружаем если уже достаточно треков впереди
    if (currentPlaylist && currentTrack) {
      const currentIndex = currentPlaylist.findIndex(track => track.id === currentTrack.id);
      const remainingTracks = currentPlaylist.length - currentIndex - 1;
      if (remainingTracks > 5) {
        console.log(`[Wave] Sufficient tracks ahead (${remainingTracks}), skipping load...`);
        return;
      }
    }
    
    console.log('[Wave] Loading more wave tracks in background...');
    setIsLoadingMoreTracks(true);
    
    const requestId = Date.now();
    loadingRequestRef.current = requestId;
    
    // Выполняем загрузку в следующем тике, чтобы не блокировать UI
    setTimeout(async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/yandex-music/wave/next', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            count: 5,  // Загружаем 5 треков для волны
            usedTrackIds: currentPlaylist ? currentPlaylist.map(track => track.id) : activeWave.tracks.map(track => track.id)  // Передаем все треки из текущего плейлиста
          })
        });

        // Проверяем что запрос все еще актуален
        if (loadingRequestRef.current !== requestId) {
          console.log('[Wave] Request outdated, discarding...');
          return;
        }

        const data = await response.json();
        if (data.success && data.tracks) {
          const newTracks = data.tracks;
          console.log(`[Wave] Adding ${newTracks.length} more tracks to wave`);
          
          // Используем функциональные обновления для избежания race conditions
          setActiveWave(prev => {
            const updatedTracks = [...prev.tracks, ...newTracks];
            
            // Обновляем текущий плейлист в отдельном микротаске
            setTimeout(() => {
              if (currentPlaylistType === 'yandex_wave' && currentTrack) {
                console.log(`[Wave] Updating active playlist with new tracks: ${updatedTracks.length} total tracks`);
                // Используем альтернативный способ обновления плейлиста без вызова onPlayTrack
                if (window.updatePlaylistWithoutInterruption) {
                  window.updatePlaylistWithoutInterruption(updatedTracks);
                } else if (window.updateCurrentPlaylist) {
                  // Альтернативный метод обновления плейлиста
                  window.updateCurrentPlaylist(updatedTracks);
                } else {
                  // Фолбэк: всегда обновляем плейлист, но сохраняем текущую позицию
                  console.log('[Wave] Using fallback playlist update');
                  onPlayTrack(currentTrack, 'yandex_wave', updatedTracks);
                }
              }
            }, 0);
            
            return {
              ...prev,
              tracks: updatedTracks
            };
          });
        } else {
          console.log('[Wave] No new tracks received in response');
        }
      } catch (error) {
        console.error('[Wave] Error loading more tracks:', error);
      } finally {
        loadingRequestRef.current = null; // Очищаем ref
        setIsLoadingMoreTracks(false);
      }
    }, 0); // Минимальная задержка для неблокирующего выполнения
  };

  // Экспорт функции loadMoreWaveTracks в window для использования из App.js
  useEffect(() => {
    window.loadMoreWaveTracks = loadMoreWaveTracks;
    return () => {
      window.loadMoreWaveTracks = null;
    };
  }, [loadMoreWaveTracks]);

  const refreshWave = () => {
    loadRecommendations(true); // Передаем isRefresh = true для плавной анимации
  };

  // Перезапуск волны с новыми настройками
  const restartWaveWithNewSettings = async (newSettings) => {
    console.log('[Wave] Restarting wave with new settings:', newSettings);
    setWaveLoading(true);
    
    // Запуск волны с новыми настройками в неблокирующем режиме
    setTimeout(async () => {
      try {
        const response = await startYandexWave(newSettings);
        if (response.success && response.tracks && response.tracks.length > 0) {
          const newWave = {
            tracks: response.tracks,
            currentSettings: { ...newSettings },
            isActive: true // Волна будет активна, так как мы ее сразу запускаем
          };
          
          console.log(`[Wave] Restarted with ${response.tracks.length} tracks and new settings:`, newSettings);
          setActiveWave(newWave);
          
          // Немедленно запускаем первый трек из новой волны
          setTimeout(() => {
            console.log('[Wave] Starting first track from restarted wave:', response.tracks[0].title);
            onPlayTrack(response.tracks[0], 'yandex_wave', response.tracks);
          }, 0);
          
          setWaveLoading(false);
          return true;
        } else {
          console.error('[Wave] No tracks in restarted wave response:', response);
          setWaveLoading(false);
          return false;
        }
      } catch (error) {
        console.error('[Wave] Error restarting wave:', error);
        setWaveLoading(false);
        return false;
      }
    }, 0);
  };

  const handleMoodChange = (mood) => {
    // Переключение настроения: если уже выбрано - отключаем, иначе включаем
    const newMood = waveSettings.mood === mood ? null : mood;
    setWaveSettings(prev => ({ ...prev, mood: newMood }));
    
    // Перезапускаем волну если она активна
    if (activeWave.isActive && currentPlaylistType === 'yandex_wave') {
      console.log(`[Wave] Restarting wave due to mood change: ${waveSettings.mood} -> ${newMood}`);
      restartWaveWithNewSettings({ ...waveSettings, mood: newMood });
    }
  };

  const handleCharacterChange = (character) => {
    // Переключение характера: если уже выбран - отключаем, иначе включаем
    const newCharacter = waveSettings.character === character ? null : character;
    setWaveSettings(prev => ({ ...prev, character: newCharacter }));
    
    // Перезапускаем волну если она активна
    if (activeWave.isActive && currentPlaylistType === 'yandex_wave') {
      console.log(`[Wave] Restarting wave due to character change: ${waveSettings.character} -> ${newCharacter}`);
      restartWaveWithNewSettings({ ...waveSettings, character: newCharacter });
    }
  };

  const renderWaveControlPanel = () => {
    const moodOptions = [
      { 
        key: 'cheerful', 
        label: 'Весёлое', 
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
        </svg>
      },
      { 
        key: 'calm', 
        label: 'Спокойное', 
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 12c0 0 4-8 10-8s10 8 10 8-4 8-10 8-10-8-10-8z" fill="none" stroke="currentColor" strokeWidth="2"/>
          <path d="M6 12c2-2 4-2 6 0s4 2 6 0" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      },
      { 
        key: 'sad', 
        label: 'Грустное', 
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2c0 0-2 4-2 8 0 2.21 1.79 4 4 4s4-1.79 4-4c0-4-2-8-2-8s-2 0-4 0z"/>
          <circle cx="12" cy="20" r="2"/>
        </svg>
      },
      { 
        key: 'energetic', 
        label: 'Энергичное', 
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
      }
    ];

    const characterOptions = [
      { key: 'favorite', label: 'Любимое', icon: '♥' },
      { key: 'unfamiliar', label: 'Незнакомое', icon: '?' },
      { key: 'popular', label: 'Популярное', icon: '★' }
    ];

    return (
      <div className="wave-control-panel">
        <div className="wave-panel-main">
          <div className="wave-panel-left">
            <div className="wave-play-section">
              <button 
                className={`wave-play-btn ${waveLoading ? 'loading' : ''} ${isWavePlaying && currentPlaylistType === 'yandex_wave' ? 'playing' : ''}`}
                onClick={startWaveDirectly}
                disabled={waveLoading}
              >
                {waveLoading ? (
                  <div className="wave-loading-spinner"></div>
                ) : activeWave.isActive && currentPlaylistType === 'yandex_wave' && isPlaying ? (
                  <div className="wave-fluid-animation">
                    <div className="fluid-blob blob-1"></div>
                    <div className="fluid-blob blob-2"></div>
                    <div className="fluid-blob blob-3"></div>
                  </div>
                ) : activeWave.isActive && currentPlaylistType === 'yandex_wave' ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              <div className="wave-play-info">
                <div className="wave-play-title">
                  {waveLoading ? 'Загружаем волну...' : 
                   activeWave.isActive && currentPlaylistType === 'yandex_wave' && isPlaying ? 'Играет моя волна' :
                   activeWave.isActive && currentPlaylistType === 'yandex_wave' && !isPlaying ? 'Волна на паузе' :
                   'Запустить мою волну'}
                </div>
                <div className="wave-play-subtitle">
                  Персональные рекомендации
                </div>
              </div>
            </div>

            <div className="wave-settings">
              <div className="wave-mood-selector">
                <div className="mood-label">Настроение:</div>
                <div className="mood-options">
                  {moodOptions.map(option => (
                    <button
                      key={option.key}
                      className={`mood-btn ${waveSettings.mood === option.key ? 'active' : ''}`}
                      onClick={() => handleMoodChange(option.key)}
                    >
                      <span className="mood-icon">{option.icon}</span>
                      <span className="mood-text">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="wave-character-selector">
                <div className="character-label">Характер:</div>
                <div className="character-options">
                  {characterOptions.map(option => (
                    <button
                      key={option.key}
                      className={`character-btn ${waveSettings.character === option.key ? 'active' : ''}`}
                      onClick={() => handleCharacterChange(option.key)}
                    >
                      <span className="character-icon">{option.icon}</span>
                      <span className="character-text">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {activeWave.isActive && currentTrack && currentPlaylistType === 'yandex_wave' && (
            <div className="modern-track-panel">
              <div className="track-panel-background"></div>
              <div className="track-panel-content">
                <div className="track-artwork-container">
                  <div className="track-artwork-glow"></div>
                  <div className="track-artwork">
                    <img 
                      src={currentTrack.thumbnail || '/default-cover.jpg'} 
                      alt={currentTrack.title}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className={`playback-indicator ${isPlaying ? 'playing' : 'paused'}`}>
                      <div className="wave-bars">
                        <div className="bar"></div>
                        <div className="bar"></div>
                        <div className="bar"></div>
                        <div className="bar"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="track-info-section">
                  <div className="track-primary-info">
                    <h3 className="track-title">{currentTrack.title}</h3>
                    <p className="track-artist">{currentTrack.artist || currentTrack.uploader}</p>
                  </div>
                  <div className="track-status">
                    <span className="status-badge">
                      {isPlaying ? '▶ Playing' : '⏸ Paused'}
                    </span>
                  </div>
                </div>

                <div className="track-controls">
                  <button 
                    className={`modern-btn like-btn ${(() => {
                      // Ищем трек в локальном состоянии для получения актуального feedback
                      const localTrack = activeWave.tracks.find(track => track.id === currentTrack.id);
                      return localTrack?.feedback === 'like';
                    })() ? 'active' : ''}`}
                    onClick={() => {
                      // Для треков из волны только отправляем фидбек в Яндекс
                      const localTrack = activeWave.tracks.find(track => track.id === currentTrack.id);
                      const currentFeedback = localTrack?.feedback;
                      handleWaveFeedback(currentTrack.id, currentFeedback === 'like' ? 'skip' : 'like', true);
                    }}
                    title="Нравится"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </button>
                  
                  <button
                    className={`modern-btn dislike-btn ${(() => {
                      // Ищем трек в локальном состоянии для получения актуального feedback
                      const localTrack = activeWave.tracks.find(track => track.id === currentTrack.id);
                      return localTrack?.feedback === 'dislike';
                    })() ? 'active' : ''}`}
                    onClick={() => {
                      // Мгновенно скипаем трек
                      if (onNextTrack) {
                        onNextTrack();
                      }
                      // Отправляем фидбек в фоне
                      handleWaveFeedback(currentTrack.id, 'dislike', true);
                    }}
                    title="Не нравится"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderYandexWave = () => {
    if (recommendationsData.loading) {
      return (
        <div className="wave-loader">
          <div className="spinner"></div>
          <p>Загружаем вашу волну...</p>
        </div>
      );
    }

    if (recommendationsData.error) {
      return (
        <div className="wave-loader">
          <p style={{ color: 'var(--error-color)', marginBottom: '16px' }}>
            {recommendationsData.error}
          </p>
          <button 
            className="wave-btn primary" 
            onClick={refreshWave}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            Попробовать снова
          </button>
        </div>
      );
    }

    return (
      <div className="yandex-wave-content">
        {renderWaveControlPanel()}
        
        <div className="wave-header">
          <div className="wave-title">
            <div className="wave-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            Рекомендации
          </div>
          <div className="wave-controls">
            <button 
              className="wave-btn secondary" 
              onClick={refreshWave}
              title="Обновить рекомендации"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="wave-tracks">
          {recommendationsData.tracks.length === 0 && !recommendationsData.isRefreshing ? (
            <div className="wave-loader">
              <p>Нет доступных рекомендаций</p>
              <p style={{ fontSize: '12px', opacity: 0.7 }}>
                Убедитесь, что вы авторизованы в Яндекс.Музыке
              </p>
            </div>
          ) : (
            <>
              {recommendationsData.isRefreshing && (
                <div className="tracks-loading-overlay">
                  <div className="tracks-spinner"></div>
                  <p>Обновляем рекомендации...</p>
                </div>
              )}
              <div className={`tracks-container ${recommendationsData.isRefreshing ? 'refreshing' : ''}`}>
                {recommendationsData.tracks.map((track, index) => (
                  <div 
                    key={track.id || index}
                    className={`wave-track ${currentTrack?.id === track.id && isPlaying ? 'playing' : ''} ${recommendationsData.isRefreshing ? 'fade-out' : 'fade-in'}`}
                    onClick={() => handleTrackPlay(track, false)}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <img 
                      src={track.thumbnail || '/default-cover.jpg'} 
                      alt={track.title}
                      className="track-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="track-info">
                      <div className="track-title">{track.title}</div>
                      <div className="track-artist">{track.artist || track.uploader}</div>
                    </div>
                    <div className="track-actions">
                      <button
                        className={`track-action-btn ${track.feedback === 'like' ? 'liked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWaveFeedback(track.id, track.feedback === 'like' ? 'skip' : 'like', false);
                        }}
                        title="Нравится"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                      </button>
                      <button
                        className={`track-action-btn ${track.feedback === 'dislike' ? 'disliked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWaveFeedback(track.id, track.feedback === 'dislike' ? 'skip' : 'dislike', false);
                        }}
                        title="Не нравится"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderPlatformPlaceholder = (platform, icon) => {
    return (
      <div className="platform-placeholder">
        <div className="icon">{icon}</div>
        <h3>{platform}</h3>
        <p>Рекомендации для этой платформы находятся в разработке</p>
      </div>
    );
  };

  return (
    <div className="recommendations-tab">
      <div className="search-content-container">
        <div className="search-type-tabs">
          <button
            className={`search-type-tab ${activeTab === 'yandex' ? 'active' : ''}`}
            onClick={() => setActiveTab('yandex')}
          >
            <svg width="16" height="16" viewBox="0 0 48 48" fill="currentColor">
              <path d="M24.001,44.001c11.045,0,20-8.955,20-20s-8.955-20-20-20c-11.045,0-20,8.955-20,20S12.956,44.001,24.001,44.001z"/>
              <path fill="#fcbe2d" d="M39.2,20.019l-0.129-0.607l-5.097-0.892l2.968-4.021L36.6,14.104l-4.364,2.104l0.552-5.573l-0.447-0.261l-2.655,4.52l-2.971-6.728h-0.524l0.709,6.491l-7.492-6.019l-0.631,0.184l5.757,7.281l-11.407-3.812l-0.527,0.58L22.8,18.705L8.739,19.887l-0.157,0.868l14.612,1.601L10.999,32.504l0.527,0.708l14.508-7.937l-2.864,13.984h0.868l5.569-13.168L33,36.392l0.603-0.473L32.212,25.46l5.28,6.019l0.341-0.555l-4.045-7.463l5.649,2.103l0.053-0.631l-5.072-3.76L39.2,20.019z"/>
            </svg>
            Яндекс.Музыка
          </button>
          
          <button
            className={`search-type-tab ${activeTab === 'soundcloud' ? 'active' : ''} disabled`}
            onClick={() => {}} // Отключено
            onMouseEnter={() => setHoveredTab('soundcloud')}
            onMouseLeave={() => setHoveredTab(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027c-.302-.024-.526-.30-1 .122v5.689c.446.143.636.138 1 .138v-5.949z"/>
            </svg>
            <ScrambleText
              originalText="SoundCloud"
              targetText="В разработке"
              isHovered={hoveredTab === 'soundcloud'}
              delay={0}
            />
          </button>
          
          <button
            className={`search-type-tab ${activeTab === 'youtube' ? 'active' : ''} disabled`}
            onClick={() => {}} // Отключено
            onMouseEnter={() => setHoveredTab('youtube')}
            onMouseLeave={() => setHoveredTab(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <ScrambleText
              originalText="YouTube Music"
              targetText="В разработке"
              isHovered={hoveredTab === 'youtube'}
              delay={50}
            />
          </button>
          
          <button
            className={`search-type-tab ${activeTab === 'spotify' ? 'active' : ''} disabled`}
            onClick={() => {}} // Отключено
            onMouseEnter={() => setHoveredTab('spotify')}
            onMouseLeave={() => setHoveredTab(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            <ScrambleText
              originalText="Spotify"
              targetText="В разработке"
              isHovered={hoveredTab === 'spotify'}
              delay={100}
            />
          </button>
        </div>

        <div className="search-content">
          <div className="rec-content">
            <div className={`rec-platform-content ${activeTab === 'yandex' ? 'active' : ''}`}>
              {renderYandexWave()}
            </div>
            
            <div className={`rec-platform-content ${activeTab === 'soundcloud' ? 'active' : ''}`}>
              {renderPlatformPlaceholder('SoundCloud', 
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027c-.302-.024-.526-.30-1 .122v5.689c.446.143.636.138 1 .138v-5.949z"/>
                </svg>
              )}
            </div>
            
            <div className={`rec-platform-content ${activeTab === 'youtube' ? 'active' : ''}`}>
              {renderPlatformPlaceholder('YouTube Music',
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              )}
            </div>
            
            <div className={`rec-platform-content ${activeTab === 'spotify' ? 'active' : ''}`}>
              {renderPlatformPlaceholder('Spotify',
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecommendationsTab;