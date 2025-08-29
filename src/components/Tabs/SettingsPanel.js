import React, { useState, useEffect } from 'react';
import './SettingsPanel.css';
import '../AuthenticationPanel.css';
import ColorPicker from '../ColorPicker';
import AudioVisualizer from '../AudioVisualizer';
import AuthenticationPanel from '../AuthenticationPanel';
import {
    getCacheInfo,
    clearAllData,
    exportAllData,
    importAllData
} from '../../services/api';
import {
    changeTheme,
    getCurrentTheme,
    getAvailableThemes,
    changeAccentColor,
    getThemeAccentColor,
    changeVisualizerWaveColor,
    getVisualizerWaveColor,
    getVisualizerWaveGradientEnabled,
    saveVisualizerWaveGradientEnabled,
    applyTheme
} from '../../theme';

const STORAGE_KEYS = {
    TRACKS_PLAYED: 'stats_tracks_played',
    LISTENING_TIME: 'stats_listening_time',
    FAVORITE_TRACKS: 'stats_favorite_tracks',
    COMPLETED_TRACKS: 'stats_completed_tracks',
};

const isWaveVisualizerType = (type) => {
    return type === AudioVisualizer.TYPES.WAVE || type === AudioVisualizer.TYPES.WAVE_CENTERED;
};

const SupportIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
            fill="currentColor" />
    </svg>
);

const WidgetsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 13h8v8h-8v-8zM3 21h8v-8H3v8zM3 3v8h8V3H3zm13.66-1.31L11 7.34 16.66 13l5.66-5.66-5.66-5.65z"
            fill="currentColor" />
    </svg>
);

const AppearanceIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
            fill="currentColor" />
    </svg>
);

const VisualizerIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
            fill="currentColor" />
    </svg>
);

const YouTubeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="currentColor"/>
    </svg>
);


const YandexMusicIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#FFD93D"/>
        <path d="M12 6C8.686 6 6 8.686 6 12s2.686 6 6 6 6-2.686 6-6-2.686-6-6-6zm2.293 6.707l-3.586 3.586a1 1 0 01-1.414-1.414L12.586 12 9.293 8.707a1 1 0 011.414-1.414l3.586 3.586a1 1 0 010 1.414z" fill="#333"/>
    </svg>
);

const DatabaseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="12" cy="5" rx="9" ry="3" fill="currentColor" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
);

const LogsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" strokeWidth="2" />
        <polyline points="14,2 14,8 20,8" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2" />
        <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="2" />
    </svg>
);


const CollectionIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5c0 1.38-1.12 2.5-2.5 2.5S10 13.88 10 12.5s1.12-2.5 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z" />
    </svg>
);

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, isDestructive = false }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3 className="modal-title">{title}</h3>
                <p className="modal-text">{message}</p>
                <div className="modal-buttons">
                    <button className="modal-button modal-button-cancel" onClick={onCancel}>
                        Отмена
                    </button>
                    <button
                        className={`modal-button modal-button-confirm ${isDestructive ? 'destructive' : ''}`}
                        onClick={onConfirm}
                    >
                        Подтвердить
                    </button>
                </div>
            </div>
        </div>
    );
};

const ModernToggle = ({ checked, onChange, disabled = false }) => (
    <div
        className={`modern-toggle ${checked ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={!disabled ? onChange : undefined}
    >
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
        />
    </div>
);

const SettingsPanel = ({
    onClose,
    visualizerType,
    setVisualizerType,
    visibleWidgets,
    toggleWidgetVisibility,
    clearGifsFromDB,
    dbInitialized,
    hideCloseButton = false,
    // Настройки коллекции
    playlistViewType = 'grid',
    onPlaylistViewTypeChange,
    trackViewType = 'default',
    onTrackViewTypeChange,
    favoritesPreviewEnabled = false,
    onFavoritesPreviewToggle
}) => {
    const [currentTheme, setCurrentTheme] = useState(getCurrentTheme());
    const [availableThemes, setAvailableThemes] = useState([]);
    const [accentColor, setAccentColor] = useState(getThemeAccentColor(currentTheme) || '');
    const [waveColor, setWaveColor] = useState(getVisualizerWaveColor(currentTheme) || '');
    const [waveGradientEnabled, setWaveGradientEnabled] = useState(getVisualizerWaveGradientEnabled());

    const [cacheInfo, setCacheInfo] = useState({
        total_urls: 0,
        next_cleanup_hours: 0,
        next_cleanup_minutes: 0,
        loading: true
    });


    const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
    const [isCacheClearing, setIsCacheClearing] = useState(false);
    const [cacheLastUpdated, setCacheLastUpdated] = useState(Date.now());
    
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = React.createRef();

    useEffect(() => {
        setAvailableThemes(getAvailableThemes());
    }, []);

    useEffect(() => {
        setAccentColor(getThemeAccentColor(currentTheme) || '');
        setWaveColor(getVisualizerWaveColor(currentTheme) || '');
    }, [currentTheme]);

    useEffect(() => {
        const loadCacheInfo = async () => {
            try {
                setCacheInfo(prev => ({ ...prev, loading: true }));
                const info = await getCacheInfo();
                setCacheInfo({ ...info, loading: false });
            } catch (error) {
                console.error('Ошибка при загрузке информации о кэше:', error);
                setCacheInfo({
                    total_urls: 0,
                    next_cleanup_hours: 0,
                    next_cleanup_minutes: 0,
                    loading: false,
                    error: error.message
                });
            }
        };

        loadCacheInfo();

        const interval = setInterval(loadCacheInfo, 60000);
        return () => clearInterval(interval);
    }, [cacheLastUpdated]);


    const handleThemeChange = (e) => {
        const newTheme = e.target.value;
        changeTheme(newTheme);
        setCurrentTheme(newTheme);
        setAccentColor(getThemeAccentColor(newTheme) || '');
        setWaveColor(getVisualizerWaveColor(newTheme) || '');
    };

    const handleAccentColorChange = (newColor) => {
        console.log(`[SettingsPanel] Меняем акцентный цвет на: ${newColor} для темы: ${currentTheme}`);
        // Немедленно обновляем состояние
        setAccentColor(newColor);
        // Сразу применяем изменения к теме - это пересчитает ВСЕ CSS переменные
        const success = changeAccentColor(currentTheme, newColor);
        if (success) {
            console.log('[SettingsPanel] Принудительно применяем тему для мгновенного эффекта');
            // Принудительно применяем тему еще раз для гарантии мгновенного эффекта
            applyTheme(currentTheme);
        } else {
            console.error('[SettingsPanel] Ошибка при изменении акцентного цвета');
        }
    };

    const handleWaveColorChange = (newColor) => {
        // Немедленно обновляем состояние
        setWaveColor(newColor);
        // Сразу применяем изменения к теме
        const success = changeVisualizerWaveColor(currentTheme, newColor);
        if (success) {
            // Принудительно применяем тему еще раз для гарантии мгновенного эффекта
            applyTheme(currentTheme);
        }
    };

    const toggleWaveGradient = () => {
        const newState = !waveGradientEnabled;
        setWaveGradientEnabled(newState);
        saveVisualizerWaveGradientEnabled(newState);
        document.documentElement.style.setProperty('--visualizer-wave-gradient-enabled', newState ? '1' : '0');
    };


    const handleDownloadLogs = () => {
        try {
            window.open('http://localhost:5000/api/logs', '_blank');
        } catch (error) {
            console.error('Ошибка при скачивании логов:', error);
            alert('Не удалось скачать лог файл. Пожалуйста, попробуйте позже.');
        }
    };

    const handleClearAllData = async () => {
        setShowClearAllConfirm(false);
        setIsCacheClearing(true);

        try {
            const result = await clearAllData();
            if (result.success) {
                Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
                localStorage.removeItem('currentTrack');
                localStorage.removeItem('currentPlaybackTime');

                if (dbInitialized) {
                    await clearGifsFromDB();
                }

                setCacheLastUpdated(Date.now());
                alert('Все данные успешно удалены. Приложение будет перезагружено.');
                window.location.reload();
            } else {
                console.error('Ошибка при полной очистке данных:', result.error);
                alert('Ошибка при очистке данных: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка при полной очистке данных:', error);
            alert('Ошибка при очистке данных: ' + error.message);
        } finally {
            setIsCacheClearing(false);
        }
    };

    const handleExportData = async () => {
        setIsExporting(true);
        try {
            const result = await exportAllData();
            if (!result.success) {
                alert('Ошибка при экспорте данных: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка при экспорте данных:', error);
            alert('Ошибка при экспорте данных: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportData = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== 'application/json') {
            alert('Пожалуйста, выберите JSON файл');
            return;
        }

        setIsImporting(true);
        try {
            const result = await importAllData(file);
            if (result.success) {
                const confirmReload = window.confirm('Данные успешно импортированы! Перезагрузить страницу для применения изменений?');
                if (confirmReload) {
                    window.location.reload();
                }
            } else {
                alert('Ошибка при импорте данных: ' + result.error);
            }
        } catch (error) {
            console.error('Ошибка при импорте данных:', error);
            alert('Ошибка при импорте данных: ' + error.message);
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };


    return (
        <>
            <div className="settings-panel">
                <div className="settings-header">
                    <h3>Настройки</h3>
                    {!hideCloseButton && (
                        <button className="close-button" onClick={onClose}>✕</button>
                    )}
                </div>

                <div className="support-section">
                    <div className="support-title">
                        <SupportIcon />
                        Поддержать автора
                    </div>
                    <div className="support-description">
                        Если вам нравится приложение, вы можете поддержать разработку
                    </div>
                    <a
                        href="https://www.donationalerts.com/r/maimed6"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="support-button"
                    >
                        <span>💝</span>
                        Поддержать проект
                    </a>
                </div>

                <AuthenticationPanel />

                <div className="settings-section">
                    <div className="settings-section-header">
                        <WidgetsIcon />
                        <h4>Виджеты</h4>
                    </div>
                    <div className="widget-toggle-item">
                        <span className="widget-toggle-label">Прослушано треков</span>
                        <ModernToggle
                            checked={visibleWidgets.tracksPlayed}
                            onChange={() => toggleWidgetVisibility('tracksPlayed')}
                        />
                    </div>
                    <div className="widget-toggle-item">
                        <span className="widget-toggle-label">Время прослушивания</span>
                        <ModernToggle
                            checked={visibleWidgets.listeningTime}
                            onChange={() => toggleWidgetVisibility('listeningTime')}
                        />
                    </div>
                    <div className="widget-toggle-item">
                        <span className="widget-toggle-label">Любимый трек</span>
                        <ModernToggle
                            checked={visibleWidgets.favoriteTrack}
                            onChange={() => toggleWidgetVisibility('favoriteTrack')}
                        />
                    </div>
                    <div className="widget-toggle-item">
                        <span className="widget-toggle-label">GIF анимация</span>
                        <ModernToggle
                            checked={visibleWidgets.gifWidget}
                            onChange={() => toggleWidgetVisibility('gifWidget')}
                        />
                    </div>
                </div>

                <div className="settings-section">
                    <div className="settings-section-header">
                        <AppearanceIcon />
                        <h4>Оформление</h4>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Тема оформления</div>
                            <div className="settings-item-description">Выберите темную или светлую тему</div>
                        </div>
                        <select
                            value={currentTheme}
                            onChange={handleThemeChange}
                            className="modern-select"
                        >
                            {availableThemes.map(theme => (
                                <option key={theme.id} value={theme.id}>
                                    {theme.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Акцентный цвет</div>
                            <div className="settings-item-description">Основной цвет для кнопок и элементов интерфейса</div>
                        </div>
                        <ColorPicker
                            color={accentColor}
                            onChange={handleAccentColorChange}
                            label=""
                        />
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Стиль визуализатора</div>
                            <div className="settings-item-description">Выберите тип отображения аудио</div>
                        </div>
                        <select
                            value={visualizerType}
                            onChange={(e) => setVisualizerType(e.target.value)}
                            className="modern-select"
                        >
                            {Object.entries(AudioVisualizer.TYPES).map(([key, value]) => (
                                <option key={value} value={value}>
                                    {AudioVisualizer.NAMES[value]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Режим интерфейса</div>
                            <div className="settings-item-description">Выберите расположение плеера и навигации</div>
                        </div>
                        <select
                            value={localStorage.getItem('horizontalMode') === 'true' ? 'true' : 'false'}
                            onChange={(e) => {
                                const isHorizontal = e.target.value === 'true';
                                localStorage.setItem('horizontalMode', isHorizontal.toString());
                                if (isHorizontal) {
                                    document.documentElement.classList.add('horizontal-mode');
                                } else {
                                    document.documentElement.classList.remove('horizontal-mode');
                                }
                                window.dispatchEvent(new Event('storage'));
                            }}
                            className="modern-select"
                        >
                            <option value="false">Вертикальный</option>
                            <option value="true">Горизонтальный</option>
                        </select>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Цвет волны</div>
                            <div className="settings-item-description">Цвет отображения аудио-волн в визуализаторе</div>
                        </div>
                        <ColorPicker
                            color={waveColor}
                            onChange={handleWaveColorChange}
                            label=""
                        />
                    </div>

                    <div className="wave-controls">
                        <button
                            className="modern-button secondary"
                            onClick={() => handleWaveColorChange(accentColor)}
                        >
                            Как у темы
                        </button>
                        <div className="gradient-control">
                            <span>Градиент</span>
                            <ModernToggle
                                checked={waveGradientEnabled}
                                onChange={toggleWaveGradient}
                            />
                        </div>
                    </div>

                </div>

                <div className="settings-section">
                    <div className="settings-section-header">
                        <CollectionIcon />
                        <h4>Коллекция</h4>
                    </div>
                    
                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Вид отображения плейлистов</div>
                            <div className="settings-item-description">Выберите способ отображения ваших плейлистов</div>
                        </div>
                        <select
                            value={playlistViewType}
                            onChange={(e) => onPlaylistViewTypeChange && onPlaylistViewTypeChange(e.target.value)}
                            className="modern-select"
                        >
                            <option value="grid">Карточки (сетка)</option>
                            <option value="list">Компактный список</option>
                        </select>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Вид отображения треков</div>
                            <div className="settings-item-description">Выберите размер элементов списка треков</div>
                        </div>
                        <select
                            value={trackViewType}
                            onChange={(e) => onTrackViewTypeChange && onTrackViewTypeChange(e.target.value)}
                            className="modern-select"
                        >
                            <option value="default">Обычный</option>
                            <option value="compact">Компактный</option>
                        </select>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Предпросмотр любимых треков</div>
                            <div className="settings-item-description">Показывать случайные треки на кнопке "Любимое"</div>
                        </div>
                        <ModernToggle
                            checked={favoritesPreviewEnabled}
                            onChange={() => onFavoritesPreviewToggle && onFavoritesPreviewToggle()}
                        />
                    </div>
                </div>


                <div className="settings-section">
                    <div className="settings-section-header">
                        <LogsIcon />
                        <h4>Логи сервера</h4>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Файл логов</div>
                            <div className="settings-item-description">Скачать логи для диагностики</div>
                        </div>
                        <button
                            className="modern-button secondary"
                            onClick={handleDownloadLogs}
                        >
                            Скачать
                        </button>
                    </div>
                </div>

                <div className="settings-section">
                    <div className="settings-section-header">
                        <DatabaseIcon />
                        <h4>Управление данными</h4>
                    </div>

                    <div className="cache-info">
                        <div className="cache-info-item">
                            <div className="cache-info-label">Кэшировано URL</div>
                            <div className="cache-info-value">
                                {cacheInfo.loading ? '...' : cacheInfo.total_urls || 0}
                            </div>
                        </div>
                        <div className="cache-info-item">
                            <div className="cache-info-label">Автоочистка через</div>
                            <div className="cache-info-value">
                                {cacheInfo.loading ? '...' :
                                    `${cacheInfo.next_cleanup_hours || 0}ч ${cacheInfo.next_cleanup_minutes || 0}м`}
                            </div>
                        </div>
                    </div>

                    <div className="cache-info-description">
                        <small>
                            Кэш URL-ов треков очищается автоматически каждый час.
                            Это не занимает места на диске - сохраняются только ссылки.
                        </small>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Экспорт данных</div>
                            <div className="settings-item-description">Экспортировать плейлисты, треки и настройки в файл</div>
                        </div>
                        <button
                            className="modern-button"
                            onClick={handleExportData}
                            disabled={isExporting}
                        >
                            {isExporting ? 'Экспорт...' : 'Экспорт'}
                        </button>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Импорт данных</div>
                            <div className="settings-item-description">Импортировать данные из файла экспорта</div>
                        </div>
                        <button
                            className="modern-button"
                            onClick={handleImportData}
                            disabled={isImporting}
                        >
                            {isImporting ? 'Импорт...' : 'Импорт'}
                        </button>
                    </div>

                    <div className="settings-item">
                        <div>
                            <div className="settings-item-label">Сбросить всё</div>
                            <div className="settings-item-description">Удалить все данные приложения</div>
                        </div>
                        <button
                            className="modern-button destructive"
                            onClick={() => setShowClearAllConfirm(true)}
                            disabled={isCacheClearing}
                        >
                            {isCacheClearing ? 'Удаление...' : 'Сбросить'}
                        </button>
                    </div>
                </div>

            </div>

            <ConfirmModal
                isOpen={showClearAllConfirm}
                title="Сброс всех данных"
                message="ВНИМАНИЕ! Будут удалены ВСЕ данные: настройки, плейлисты, сохраненные треки, кэш. Действие необратимо!"
                onConfirm={handleClearAllData}
                onCancel={() => setShowClearAllConfirm(false)}
                isDestructive={true}
            />
            
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".json"
                style={{ display: 'none' }}
            />
        </>
    );
};

export default SettingsPanel;