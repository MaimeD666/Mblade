import React, { useState, useEffect, useRef } from 'react';
import Component from '../Component';
import { SearchPlaylistCard, PlaylistPreviewModal } from '../SearchPlaylistCard';
import { searchSoundCloudPlaylists, getSoundCloudPlaylistDetails } from '../../services/api';
import './SearchTab.css';

const AddToPlaylistModal = ({ isOpen, track, playlists, onClose, onAddToPlaylists, onCreateNewPlaylist }) => {
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  if (!isOpen) return null;

  const togglePlaylist = (playlistId) => {
    if (selectedPlaylists.includes(playlistId)) {
      setSelectedPlaylists(selectedPlaylists.filter(id => id !== playlistId));
    } else {
      setSelectedPlaylists([...selectedPlaylists, playlistId]);
    }
  };

  const handleAddToPlaylists = () => {
    if (selectedPlaylists.length === 0) return;
    onAddToPlaylists(track, selectedPlaylists);
    setSelectedPlaylists([]);
    onClose();
  };

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      onCreateNewPlaylist(newPlaylistName, track);
      setNewPlaylistName('');
      setShowCreateNew(false);
      onClose();
    }
  };

  return (
    <div className="modal-overlay add-to-playlist-modal">
      <div className="modal-content">
        {showCreateNew ? (
          <>
            <div className="back-button" onClick={() => setShowCreateNew(false)}>
              <span className="back-button-icon">←</span> Назад
            </div>
            <h3 className="modal-title">Создать новый плейлист</h3>
            <div className="playlist-input-container">
              <input
                type="text"
                className="playlist-name-input"
                placeholder="Название плейлиста"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-buttons">
              <div className="modal-button modal-button-cancel" onClick={onClose}>
                Отмена
              </div>
              <div className="modal-button modal-button-confirm" onClick={handleCreatePlaylist}>
                Создать
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="modal-title">Добавить трек в плейлист</h3>
            <div className="create-new-playlist-option" onClick={() => setShowCreateNew(true)}>
              <div className="create-new-playlist-icon">+</div>
              <div className="create-new-playlist-text">Создать новый плейлист</div>
            </div>

            {playlists.length > 0 ? (
              <div className="playlist-selection-list">
                {playlists.map(playlist => (
                  <div
                    key={playlist.id}
                    className="playlist-selection-item"
                    onClick={() => togglePlaylist(playlist.id)}
                  >
                    <div className={`playlist-selection-checkbox ${selectedPlaylists.includes(playlist.id) ? 'checked' : ''}`} />
                    <div className="playlist-selection-name">{playlist.name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="modal-text">У вас еще нет плейлистов. Создайте новый!</p>
            )}

            <div className="modal-buttons">
              <div className="modal-button modal-button-cancel" onClick={onClose}>
                Отмена
              </div>
              <div
                className="modal-button modal-button-confirm"
                onClick={handleAddToPlaylists}
                style={{ opacity: selectedPlaylists.length ? 1 : 0.5 }}
              >
                Добавить
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SearchBar = ({ query, onQueryChange, onSearch, searchType = 'tracks', selectedServices, onServicesChange }) => {
  const [isSearchButtonActive, setIsSearchButtonActive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleSearch = (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    setIsSearchButtonActive(true);
    onSearch(query);

    setTimeout(() => setIsSearchButtonActive(false), 1500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch(e);
    }
  };

  const handleServiceToggle = (service) => {
    const updatedServices = selectedServices.includes(service)
      ? selectedServices.filter(s => s !== service)
      : [...selectedServices, service];
    onServicesChange(updatedServices);
  };

  const handleAllServicesToggle = () => {
    const allServices = ['soundcloud', 'youtube', 'yandex_music'];
    const isAllSelected = allServices.every(service => selectedServices.includes(service));
    onServicesChange(isAllSelected ? [] : allServices);
  };

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="search-bar">
      <div className={`overlap-2 ${isSearchButtonActive ? 'searching' : ''}`}>
        {searchType === 'tracks' && (
          <div className="services-menu-container" ref={menuRef}>
            <button
              type="button"
              className="services-menu-button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
            </button>
            {isMenuOpen && (
              <div className="services-menu">
                <div className="services-menu-title">Выберите сервисы:</div>
                <div className="service-option" onClick={handleAllServicesToggle}>
                  <div className={`service-checkbox ${
                    ['soundcloud', 'youtube', 'yandex_music'].every(service => selectedServices.includes(service)) ? 'checked' : ''
                  }`} />
                  <span>Все сервисы</span>
                </div>
                <div className="service-option" onClick={() => handleServiceToggle('soundcloud')}>
                  <div className={`service-checkbox ${selectedServices.includes('soundcloud') ? 'checked' : ''}`} />
                  <div className="service-icon soundcloud">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027c-.302-.024-.526-.03-1 .122v5.689c.446.143.636.138 1 .138v-5.949z" />
                    </svg>
                  </div>
                  <span>SoundCloud</span>
                </div>
                <div className="service-option" onClick={() => handleServiceToggle('youtube')}>
                  <div className={`service-checkbox ${selectedServices.includes('youtube') ? 'checked' : ''}`} />
                  <div className="service-icon youtube">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </div>
                  <span>YouTube Music</span>
                </div>
                <div className="service-option" onClick={() => handleServiceToggle('yandex_music')}>
                  <div className={`service-checkbox ${selectedServices.includes('yandex_music') ? 'checked' : ''}`} />
                  <div className="service-icon yandex-music">
                    <svg viewBox="0 0 48 48" fill="currentColor">
                      <path fill="#212121" d="M24.001,44.001c11.045,0,20-8.955,20-20s-8.955-20-20-20c-11.045,0-20,8.955-20,20S12.956,44.001,24.001,44.001z"></path>
                      <path fill="#fcbe2d" d="M39.2,20.019l-0.129-0.607l-5.097-0.892l2.968-4.021L36.6,14.104l-4.364,2.104l0.552-5.573l-0.447-0.261l-2.655,4.52l-2.971-6.728h-0.524l0.709,6.491l-7.492-6.019l-0.631,0.184l5.757,7.281l-11.407-3.812l-0.527,0.58L22.8,18.705L8.739,19.887l-0.157,0.868l14.612,1.601L10.999,32.504l0.527,0.708l14.508-7.937l-2.864,13.984h0.868l5.569-13.168L33,36.392l0.603-0.473L32.212,25.46l5.28,6.019l0.341-0.555l-4.045-7.463l5.649,2.103l0.053-0.631l-5.072-3.76L39.2,20.019z"></path>
                    </svg>
                  </div>
                  <span>Яндекс.Музыка</span>
                </div>
              </div>
            )}
          </div>
        )}
        <input
          type="text"
          className="search-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={searchType === 'tracks' ? 'Поиск трека' : 'Поиск плейлистов'}
          style={{ paddingLeft: searchType === 'tracks' ? '75px' : '33px' }}
        />
        <button
          type="button"
          className={`search-button ${isSearchButtonActive ? 'active' : ''}`}
          onClick={handleSearch}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

const LoadingAnimation = () => {
  return (
    <div className="loading-animation">
      <div className="loading-circle"></div>
      <div className="loading-circle"></div>
      <div className="loading-circle"></div>
    </div>
  );
};


const SearchTab = ({
  onPlayTrack,
  searchQuery,
  onQueryChange,
  onSearch,
  searchResults,
  isSearching,
  wasSearched,
  currentTrack,
  isPlaying,
  unavailableTracks = {},
  toggleLike = () => { },
  likedTracks = [],
  addTrackToPlaylist = () => { },
  playlists = [],
  addTrackToPlaylists = () => { },
  createPlaylist = () => { },
  setPlaylists = () => { },
  savePlaylistsToServer = () => { }
}) => {
  const [searchType, setSearchType] = useState('tracks'); // 'tracks' или 'playlists'
  const [selectedServices, setSelectedServices] = useState(['soundcloud', 'youtube', 'yandex_music']);
  const listRef = useRef(null);
  const [addToPlaylistModal, setAddToPlaylistModal] = useState({ isOpen: false, track: null });
  const [playlistResults, setPlaylistResults] = useState([]);
  const [isSearchingPlaylists, setIsSearchingPlaylists] = useState(false);
  const [playlistPreviewModal, setPlaylistPreviewModal] = useState({ isOpen: false, playlist: null });

  const filteredResults = selectedServices.length === 0 || selectedServices.includes('all')
    ? searchResults
    : searchResults.filter(track => selectedServices.includes(track.platform));

  const sortedResults = [...filteredResults].sort((a, b) => {
    // Порядок приоритета: SoundCloud > Yandex Music > YouTube > VK Music
    const platformPriority = {
      'soundcloud': 0,
      'yandex_music': 1,
      'youtube': 2,
      'vkmusic': 3
    };

    const priorityA = platformPriority[a.platform] ?? 999;
    const priorityB = platformPriority[b.platform] ?? 999;

    return priorityA - priorityB;
  });

  const handleServicesChange = (services) => {
    setSelectedServices(services);
  };

  const isTrackUnavailable = (track) => {
    if (!track) return false;
    const trackKey = `${track.platform}:${track.id}`;
    return !!unavailableTracks[trackKey];
  };

  const isTrackLiked = (track) => {
    if (!track || !likedTracks || !likedTracks.length) return false;
    return likedTracks.some(t => t.id === track.id && t.platform === track.platform);
  };

  const formatDuration = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'youtube':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="platform-icon-svg youtube">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        );
      case 'soundcloud':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="platform-icon-svg soundcloud">
            <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027c-.302-.024-.526-.03-1 .122v5.689c.446.143.636.138 1 .138v-5.949z" />
          </svg>
        );
      case 'yandex_music':
        return (
          <svg viewBox="0 0 48 48" fill="currentColor" className="platform-icon-svg yandex-music">
            <path fill="#212121" d="M24.001,44.001c11.045,0,20-8.955,20-20s-8.955-20-20-20c-11.045,0-20,8.955-20,20S12.956,44.001,24.001,44.001z"></path>
            <path fill="#fcbe2d" d="M39.2,20.019l-0.129-0.607l-5.097-0.892l2.968-4.021L36.6,14.104l-4.364,2.104l0.552-5.573l-0.447-0.261l-2.655,4.52l-2.971-6.728h-0.524l0.709,6.491l-7.492-6.019l-0.631,0.184l5.757,7.281l-11.407-3.812l-0.527,0.58L22.8,18.705L8.739,19.887l-0.157,0.868l14.612,1.601L10.999,32.504l0.527,0.708l14.508-7.937l-2.864,13.984h0.868l5.569-13.168L33,36.392l0.603-0.473L32.212,25.46l5.28,6.019l0.341-0.555l-4.045-7.463l5.649,2.103l0.053-0.631l-5.072-3.76L39.2,20.019z"></path>
          </svg>
        );
      case 'vkmusic':
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className="platform-icon-svg vkmusic">
            <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.113 4 7.676c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.847 2.472 2.27 4.642 2.856 4.642.22 0 .322-.102.322-.66V8.926c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.743c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.15-3.574 2.15-3.574.119-.254.373-.491.712-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.745-.576.745z" />
          </svg>
        );
      default:
        return null;
    }
  };


  const handleTrackClick = (track) => {
    if (isTrackUnavailable(track)) {
      console.log(`Трек ${track.title} недоступен`);
      return;
    }

    onPlayTrack(track);
  };

  const handleLikeTrack = (track) => {
    if (toggleLike) toggleLike(track);
  };

  const handleAddToPlaylist = (track) => {
    setAddToPlaylistModal({ isOpen: true, track });
  };

  // Обработчик поиска с учетом типа поиска и выбранных сервисов
  const handleSearchSubmit = async (query) => {
    if (searchType === 'tracks') {
      // Передаем выбранные сервисы в функцию поиска
      onSearch(query, selectedServices);
    } else {
      setIsSearchingPlaylists(true);
      try {
        const playlists = await searchSoundCloudPlaylists(query);
        setPlaylistResults(playlists);
      } finally {
        setIsSearchingPlaylists(false);
      }
    }
  };

  // Обработчик предпросмотра плейлиста
  const handlePlaylistPreview = async (playlist) => {
    if (playlist.tracks && playlist.tracks.length > 0) {
      // Если у плейлиста уже есть треки, показываем предпросмотр
      setPlaylistPreviewModal({ isOpen: true, playlist });
    } else {
      // Если треков нет или массив пустой (быстрый поиск), загружаем полную информацию
      try {
        const fullPlaylist = await getSoundCloudPlaylistDetails(playlist.id);
        if (fullPlaylist) {
          setPlaylistPreviewModal({ isOpen: true, playlist: fullPlaylist });
        }
      } catch (error) {
        console.error('Ошибка загрузки полной информации о плейлисте:', error);
      }
    }
  };

  // Обработчик быстрого импорта плейлиста
  const handlePlaylistImport = async (playlist) => {
    let playlistToImport = playlist;
    
    // Если у плейлиста нет треков или массив пустой (быстрый поиск), загружаем полную информацию
    if (!playlist.tracks || playlist.tracks.length === 0) {
      try {
        playlistToImport = await getSoundCloudPlaylistDetails(playlist.id);
        if (!playlistToImport) return;
      } catch (error) {
        console.error('Ошибка загрузки полной информации для импорта:', error);
        return;
      }
    }

    // Создаем новый плейлист в приложении
    const newPlaylist = {
      id: Date.now(),
      name: playlistToImport.title,
      tracks: playlistToImport.tracks || []
    };

    // Добавляем плейлист в локальное состояние
    const updatedPlaylists = [newPlaylist, ...playlists];
    setPlaylists(updatedPlaylists);

    // Сохраняем обновленные плейлисты на сервере
    try {
      await savePlaylistsToServer(updatedPlaylists, likedTracks);
    } catch (error) {
      console.error('Error saving playlist:', error);
    }
  };

  // Обработчик воспроизведения трека из плейлиста
  const handlePlaylistTrackPlay = (track) => {
    onPlayTrack(track);
  };

  return (
    <div className="search-tab-wrapper">
      <SearchBar
        query={searchQuery}
        onQueryChange={onQueryChange}
        onSearch={handleSearchSubmit}
        searchType={searchType}
        selectedServices={selectedServices}
        onServicesChange={handleServicesChange}
      />

      <div className="search-content-container">
        <div className="search-type-tabs">
          <button
            className={`search-type-tab ${searchType === 'tracks' ? 'active' : ''}`}
            onClick={() => setSearchType('tracks')}
          >
            Треки
          </button>
          <button
            className={`search-type-tab ${searchType === 'playlists' ? 'active' : ''}`}
            onClick={() => setSearchType('playlists')}
          >
            Плейлисты
          </button>
        </div>
        
        <div className="search-content">
          <div className="track-cards-list" ref={listRef}>
            {searchType === 'tracks' ? (
              // Результаты поиска треков
              <>
                {isSearching ? (
                  <div className="loading">
                    <LoadingAnimation />
                    <p>Загрузка треков...</p>
                  </div>
                ) : !wasSearched ? (
                  <div className="no-results">
                    <p>Введите запрос в поисковую строку</p>
                  </div>
                ) : sortedResults.length === 0 ? (
                  <div className="no-results">
                    <p>По вашему запросу ничего не найдено</p>
                  </div>
                ) : (
                  <div className="tracks-list">
                    {sortedResults.map((track) => {
                      const trackIsUnavailable = isTrackUnavailable(track);
                      const trackIsLiked = isTrackLiked(track);
                      const isCurrentTrack = currentTrack && 
                        currentTrack.id === track.id && 
                        currentTrack.platform === track.platform;

                      return (
                        <div 
                          key={`${track.platform}-${track.id}`} 
                          className={`track-list-item ${trackIsUnavailable ? 'unavailable' : ''} ${isCurrentTrack ? 'playing' : ''}`}
                          onClick={() => handleTrackClick(track)}
                        >
                          <div className="track-thumbnail">
                            {track.thumbnail ? (
                              <img src={track.thumbnail} alt={track.title} />
                            ) : (
                              <div className="no-thumbnail">♫</div>
                            )}
                            <div className="play-overlay">
                              {isCurrentTrack && isPlaying ? (
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </div>
                          </div>

                          <div className="track-info">
                            <div className="track-title">{track.title}</div>
                            <div className="track-author">{track.uploader || track.artist}</div>
                          </div>

                          <div className="track-metadata">
                            <div className="platform-icon">
                              {getPlatformIcon(track.platform)}
                            </div>
                            {track.duration && (
                              <div className="track-duration">{formatDuration(track.duration)}</div>
                            )}
                          </div>

                          <div className="track-actions">
                            <button
                              className={`action-button like-button ${trackIsLiked ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLikeTrack(track);
                              }}
                              title="Добавить в избранное"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d={trackIsLiked
                                  ? "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                                  : "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"}
                                />
                              </svg>
                            </button>
                            <button
                              className="action-button playlist-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToPlaylist(track);
                              }}
                              title="Добавить в плейлист"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              // Результаты поиска плейлистов
              <>
                {isSearchingPlaylists ? (
                  <div className="loading">
                    <LoadingAnimation />
                    <p>Загрузка плейлистов...</p>
                  </div>
                ) : playlistResults.length === 0 ? (
                  <div className="no-results">
                    <p>{wasSearched ? 'По вашему запросу плейлисты не найдены' : 'Введите запрос для поиска плейлистов'}</p>
                  </div>
                ) : (
                  <div className="search-playlists-grid">
                    {playlistResults.map((playlist, index) => (
                      <SearchPlaylistCard
                        key={playlist.id || index}
                        playlist={playlist}
                        onPreview={handlePlaylistPreview}
                        onImport={handlePlaylistImport}
                        onTrackPlay={handlePlaylistTrackPlay}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AddToPlaylistModal
        isOpen={addToPlaylistModal.isOpen}
        track={addToPlaylistModal.track}
        playlists={playlists}
        onClose={() => setAddToPlaylistModal({ isOpen: false, track: null })}
        onAddToPlaylists={addTrackToPlaylists}
        onCreateNewPlaylist={createPlaylist}
      />

      <PlaylistPreviewModal
        isOpen={playlistPreviewModal.isOpen}
        playlist={playlistPreviewModal.playlist}
        onClose={() => setPlaylistPreviewModal({ isOpen: false, playlist: null })}
        onImport={handlePlaylistImport}
        onTrackPlay={handlePlaylistTrackPlay}
      />
    </div>
  );
};

export default SearchTab;