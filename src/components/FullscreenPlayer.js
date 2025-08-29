import React, {
    useEffect,
    useRef,
    useState,
    useCallback
} from 'react';
import ReactDOM from 'react-dom';
import './FullscreenPlayer.css';
import { getLyrics, getLyricsByUrl, searchLyrics } from '../services/api';

const FullscreenPlayer = ({
    currentTrack,
    isPlaying,
    togglePlayPause,
    onPrevTrack,
    onNextTrack,
    progress,
    volume,
    formatTime,
    currentTime,
    duration,
    onClose,
    hasPrev,
    hasNext,
    isLoading
}) => {
    const [localProgress, setLocalProgress] = useState(progress);
    const [localVolume, setLocalVolume] = useState(volume);
    const [isDraggingProgress, setIsDraggingProgress] = useState(false);
    const [isDraggingVolume, setIsDraggingVolume] = useState(false);
    const [showLyrics, setShowLyrics] = useState(false);
    const [lyrics, setLyrics] = useState('');
    const [lyricsLoading, setLyricsLoading] = useState(false);
    const [lyricsError, setLyricsError] = useState('');
    const [lyricsData, setLyricsData] = useState(null);
    const [showAlternatives, setShowAlternatives] = useState(false);
    const [alternatives, setAlternatives] = useState([]);

    const audioRef = useRef(null);
    const progressBarRef = useRef(null);
    const volumeSliderRef = useRef(null);
    const lyricsContentRef = useRef(null);

    useEffect(() => {
        document.body.classList.add('hide-scroll');
        return () => {
            document.body.classList.remove('hide-scroll');
        };
    }, []);

    useEffect(() => {
        if (!isDraggingProgress) {
            setLocalProgress(progress);
        }
    }, [progress, isDraggingProgress]);

    useEffect(() => {
        if (!isDraggingVolume) {
            setLocalVolume(volume);
        }
    }, [volume, isDraggingVolume]);

    useEffect(() => {
        const audio = document.querySelector('audio');
        if (audio) {
            audioRef.current = audio;
        }
    }, []);

    useEffect(() => {
        setLyrics('');
        setLyricsError('');
        setShowLyrics(false);
        setLyricsData(null);
        setAlternatives([]);
        setShowAlternatives(false);
    }, [currentTrack]);

    const fetchLyrics = async () => {
        if (!currentTrack || !currentTrack.title) {
            setLyricsError('Недостаточно информации о треке');
            return;
        }

        setLyricsLoading(true);
        setLyricsError('');

        try {
            const result = await getLyrics(currentTrack.title, currentTrack.uploader || currentTrack.artist);

            if (result.success && result.lyrics) {
                setLyrics(result.lyrics);
                setLyricsData(result);
                setAlternatives(result.alternatives || []);
                setShowLyrics(true);
            } else {
                setLyricsError(result.message || 'Текст не найден');
                if (result.alternatives && result.alternatives.length > 0) {
                    setAlternatives(result.alternatives);
                    setShowAlternatives(true);
                }
            }
        } catch (error) {
            setLyricsError('Ошибка загрузки текста');
        } finally {
            setLyricsLoading(false);
        }
    };

    const loadAlternativeLyrics = async (alternative) => {
        setLyricsLoading(true);
        setLyricsError('');
        setShowAlternatives(false);

        try {
            const result = await getLyricsByUrl(alternative.url);

            if (result.success && result.lyrics) {
                setLyrics(result.lyrics);
                setLyricsData({
                    ...result,
                    title: alternative.title,
                    artist: alternative.artist
                });
                setShowLyrics(true);
            } else {
                setLyricsError('Не удалось загрузить альтернативный текст');
            }
        } catch (error) {
            setLyricsError('Ошибка загрузки альтернативного текста');
        } finally {
            setLyricsLoading(false);
        }
    };

    const searchMoreAlternatives = async () => {
        if (!currentTrack) return;

        setLyricsLoading(true);
        try {
            const result = await searchLyrics(currentTrack.title, currentTrack.uploader || currentTrack.artist);
            if (result.success && result.results) {
                setAlternatives(result.results);
                setShowAlternatives(true);
            }
        } catch (error) {
            setLyricsError('Ошибка поиска альтернатив');
        } finally {
            setLyricsLoading(false);
        }
    };

    const handleImageClick = () => {
        if (!currentTrack) return;

        if (!lyrics && !lyricsLoading) {
            fetchLyrics();
        } else if (lyrics) {
            setShowLyrics(!showLyrics);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            switch (e.key) {
                case 'Escape':
                    if (showAlternatives) {
                        setShowAlternatives(false);
                    } else if (showLyrics) {
                        setShowLyrics(false);
                    } else {
                        onClose();
                    }
                    break;
                case ' ':
                case 'Spacebar':
                    e.preventDefault();
                    togglePlayPause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (hasPrev) onPrevTrack();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (hasNext) onNextTrack();
                    break;
                case 'l':
                case 'L':
                    handleImageClick();
                    break;
                default:
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, togglePlayPause, onPrevTrack, onNextTrack, hasPrev, hasNext, showLyrics, showAlternatives, lyrics, lyricsLoading, currentTrack]);

    const updateProgress = useCallback((clientX, element) => {
        if (!audioRef.current || !element) return;

        const rect = element.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percent = (offsetX / rect.width) * 100;

        setLocalProgress(percent);

        if (audioRef.current.duration && isFinite(audioRef.current.duration)) {
            audioRef.current.currentTime = (percent / 100) * audioRef.current.duration;
        }
    }, []);

    const updateVolume = useCallback((clientX, element) => {
        if (!audioRef.current || !element) return;

        const rect = element.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percent = (offsetX / rect.width) * 100;

        setLocalVolume(percent);
        audioRef.current.volume = percent / 100;
    }, []);

    const handleProgressMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDraggingProgress(true);
        updateProgress(e.clientX, progressBarRef.current);
    }, [updateProgress]);

    const handleProgressClick = useCallback((e) => {
        if (!isDraggingProgress) {
            updateProgress(e.clientX, progressBarRef.current);
        }
    }, [updateProgress, isDraggingProgress]);

    const handleVolumeMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDraggingVolume(true);
        updateVolume(e.clientX, volumeSliderRef.current);
    }, [updateVolume]);

    const handleVolumeClick = useCallback((e) => {
        if (!isDraggingVolume) {
            updateVolume(e.clientX, volumeSliderRef.current);
        }
    }, [updateVolume, isDraggingVolume]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            e.preventDefault();
            if (isDraggingProgress && progressBarRef.current) {
                updateProgress(e.clientX, progressBarRef.current);
            }
            if (isDraggingVolume && volumeSliderRef.current) {
                updateVolume(e.clientX, volumeSliderRef.current);
            }
        };

        const handleMouseUp = () => {
            setIsDraggingProgress(false);
            setIsDraggingVolume(false);
        };

        const handleTouchMove = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            if (isDraggingProgress && progressBarRef.current) {
                updateProgress(touch.clientX, progressBarRef.current);
            }
            if (isDraggingVolume && volumeSliderRef.current) {
                updateVolume(touch.clientX, volumeSliderRef.current);
            }
        };

        const handleTouchEnd = () => {
            setIsDraggingProgress(false);
            setIsDraggingVolume(false);
        };

        if (isDraggingProgress || isDraggingVolume) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDraggingProgress, isDraggingVolume, updateProgress, updateVolume]);

    const handleProgressTouchStart = useCallback((e) => {
        e.preventDefault();
        const touch = e.touches[0];
        setIsDraggingProgress(true);
        updateProgress(touch.clientX, progressBarRef.current);
    }, [updateProgress]);

    const handleVolumeTouchStart = useCallback((e) => {
        e.preventDefault();
        const touch = e.touches[0];
        setIsDraggingVolume(true);
        updateVolume(touch.clientX, volumeSliderRef.current);
    }, [updateVolume]);

    return ReactDOM.createPortal(
        <div className={`fullscreen-player ${showLyrics ? 'lyrics-open' : ''}`}>
            <div className="fullscreen-player-content">
                <button
                    className="close-button"
                    onClick={onClose}
                    aria-label="Закрыть полноэкранный режим"
                >
                    <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                            fill="currentColor"
                        />
                    </svg>
                </button>

                <div className={`fullscreen-image ${isLoading ? 'loading' : ''}`} onClick={handleImageClick}>
                    {currentTrack && currentTrack.thumbnail ? (
                        <img
                            src={currentTrack.thumbnail}
                            alt={currentTrack.title}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="empty-fullscreen-image">♫</div>
                    )}
                    <div className="lyrics-overlay">
                        <div className="lyrics-icon">♪</div>
                    </div>
                    {isLoading && (
                        <div className="fullscreen-loading-spinner"></div>
                    )}
                </div>

                <div className="fullscreen-track-info">
                    <h2 className="fullscreen-track-title">
                        {currentTrack?.title || 'Нет трека'}
                    </h2>
                    <h3 className="fullscreen-track-author">
                        {currentTrack?.uploader || currentTrack?.artist || ''}
                    </h3>
                </div>

                <div className="fullscreen-playback-controls">
                    <button
                        className={`fullscreen-prev-button ${!hasPrev ? 'disabled' : ''}`}
                        onClick={hasPrev ? onPrevTrack : undefined}
                        disabled={!hasPrev}
                        aria-label="Предыдущий трек"
                    >
                        <svg
                            width="30"
                            height="30"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>

                    <button
                        className="fullscreen-play-button"
                        onClick={togglePlayPause}
                        aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
                    >
                        {isPlaying ? (
                            <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z"
                                    fill="currentColor"
                                />
                            </svg>
                        ) : (
                            <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M8 5.14V19.14C8 19.94 8.85 20.44 9.54 20.05L20.54 13.05C21.15 12.71 21.15 11.81 20.54 11.47L9.54 4.47C8.85 4.08 8 4.58 8 5.14Z"
                                    fill="currentColor"
                                />
                            </svg>
                        )}
                    </button>

                    <button
                        className={`fullscreen-next-button ${!hasNext ? 'disabled' : ''}`}
                        onClick={hasNext ? onNextTrack : undefined}
                        disabled={!hasNext}
                        aria-label="Следующий трек"
                    >
                        <svg
                            width="30"
                            height="30"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                </div>

                <div className="fullscreen-progress-container">
                    <span className="fullscreen-current-time">
                        {formatTime(currentTime)}
                    </span>
                    <div
                        ref={progressBarRef}
                        className="fullscreen-progress-bar"
                        onClick={handleProgressClick}
                        onMouseDown={handleProgressMouseDown}
                        onTouchStart={handleProgressTouchStart}
                        role="slider"
                        aria-label="Прогресс воспроизведения"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={localProgress}
                    >
                        <div
                            className="fullscreen-progress"
                            style={{
                                width: `${Math.max(0, Math.min(localProgress, 100))}%`
                            }}
                        >
                            <div className="fullscreen-progress-knob"></div>
                        </div>
                    </div>
                    <span className="fullscreen-duration">
                        {formatTime(duration)}
                    </span>
                </div>

                <div className="fullscreen-volume-container">
                    <div className="fullscreen-volume-icon">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"
                                fill="currentColor"
                            />
                        </svg>
                    </div>
                    <div
                        ref={volumeSliderRef}
                        className="fullscreen-volume-slider"
                        onClick={handleVolumeClick}
                        onMouseDown={handleVolumeMouseDown}
                        onTouchStart={handleVolumeTouchStart}
                        role="slider"
                        aria-label="Громкость"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={localVolume}
                    >
                        <div
                            className="fullscreen-volume-level"
                            style={{
                                width: `${Math.max(0, Math.min(localVolume, 100))}%`
                            }}
                        >
                            <div className="fullscreen-volume-knob"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`lyrics-panel ${showLyrics ? 'open' : ''}`}>
                <div className="lyrics-header">
                    <h2>{lyricsData?.title || currentTrack?.title || 'Нет трека'}</h2>
                    <h3>{lyricsData?.artist || currentTrack?.uploader || currentTrack?.artist || ''}</h3>
                    <div className="lyrics-controls">
                        {alternatives.length > 0 && (
                            <button
                                className="lyrics-error button"
                                onClick={() => setShowAlternatives(true)}
                                style={{
                                    background: 'rgba(var(--control-bg-rgb, 189, 99, 212), 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: 'white',
                                    padding: '8px 16px',
                                    borderRadius: '25px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                Альтернативы ({alternatives.length})
                            </button>
                        )}
                        <button
                            className="lyrics-close-btn"
                            onClick={() => setShowLyrics(false)}
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="lyrics-content" ref={lyricsContentRef}>
                    {lyricsLoading ? (
                        <div className="lyrics-loading">
                            <div className="lyrics-loading-spinner"></div>
                            Загрузка текста...
                        </div>
                    ) : lyricsError ? (
                        <div className="lyrics-error">
                            <p>{lyricsError}</p>
                            <button onClick={fetchLyrics} disabled={lyricsLoading}>
                                Попробовать снова
                            </button>
                            {alternatives.length > 0 && (
                                <button 
                                    onClick={() => setShowAlternatives(true)}
                                >
                                    Показать альтернативы ({alternatives.length})
                                </button>
                            )}
                        </div>
                    ) : lyrics ? (
                        <pre className="lyrics-text">{lyrics}</pre>
                    ) : (
                        <div className="lyrics-error">
                            <p>Нажмите на изображение трека, чтобы загрузить текст</p>
                        </div>
                    )}
                </div>
            </div>

            {showAlternatives && (
                <div className="alternatives-container">
                    <div className="alternatives-header">
                        <h2>Выберите правильную песню</h2>
                        <button
                            className="alternatives-close"
                            onClick={() => setShowAlternatives(false)}
                        >
                            ×
                        </button>
                    </div>

                    <div className="alternatives-list">
                        {alternatives.map((alt, index) => (
                            <div
                                key={index}
                                className="alternative-item"
                                onClick={() => loadAlternativeLyrics(alt)}
                            >
                                <div className="alternative-info">
                                    <div className="alternative-title">{alt.title}</div>
                                    <div className="alternative-artist">{alt.artist}</div>
                                    {alt.relevance_score && (
                                        <div className="alternative-score">
                                            Точность: {alt.relevance_score.toFixed(1)}
                                        </div>
                                    )}
                                </div>
                                <div className="alternative-arrow">→</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '20px', textAlign: 'center' }}>
                        <button
                            className="lyrics-error button"
                            onClick={searchMoreAlternatives}
                            disabled={lyricsLoading}
                            style={{
                                background: 'rgba(var(--control-bg-rgb, 189, 99, 212), 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                padding: '12px 24px',
                                borderRadius: '25px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            Найти еще варианты
                        </button>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default FullscreenPlayer;