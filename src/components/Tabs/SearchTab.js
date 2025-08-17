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

const SearchBar = ({ query, onQueryChange, onSearch, searchType = 'tracks' }) => {
  const [isSearchButtonActive, setIsSearchButtonActive] = useState(false);

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

  return (
    <div className="search-bar">
      <div className={`overlap-2 ${isSearchButtonActive ? 'searching' : ''}`}>
        <input
          type="text"
          className="search-input"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={searchType === 'tracks' ? 'Поиск трека' : 'Поиск плейлистов'}
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
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [searchType, setSearchType] = useState('tracks'); // 'tracks' или 'playlists'
  const listRef = useRef(null);
  const rowHeight = 230;
  const [addToPlaylistModal, setAddToPlaylistModal] = useState({ isOpen: false, track: null });
  const [playlistResults, setPlaylistResults] = useState([]);
  const [isSearchingPlaylists, setIsSearchingPlaylists] = useState(false);
  const [playlistPreviewModal, setPlaylistPreviewModal] = useState({ isOpen: false, playlist: null });

  const filteredResults = platformFilter === 'all'
    ? searchResults
    : searchResults.filter(track => track.platform === platformFilter);

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (a.platform === 'soundcloud' && b.platform !== 'soundcloud') return -1;
    if (a.platform !== 'soundcloud' && b.platform === 'soundcloud') return 1;

    if (a.platform === 'vkmusic' && b.platform === 'youtube') return -1;
    if (a.platform === 'youtube' && b.platform === 'vkmusic') return 1;

    return 0;
  });

  const handleFilterChange = (platform) => {
    setPlatformFilter(platform);
    setCurrentRowIndex(0);
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

  const handleWheel = (e) => {
    // Только для треков, не для плейлистов
    if (searchType !== 'tracks') return;
    
    e.preventDefault();

    const totalRows = Math.ceil(sortedResults.length / 3);
    const maxRowIndex = Math.max(0, totalRows - 3);

    if (e.deltaY > 0 && currentRowIndex < maxRowIndex) {
      setCurrentRowIndex(prev => prev + 1);
    } else if (e.deltaY < 0 && currentRowIndex > 0) {
      setCurrentRowIndex(prev => prev - 1);
    }
  };

  useEffect(() => {
    const listElement = listRef.current;
    if (listElement && searchType === 'tracks') {
      listElement.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        listElement.removeEventListener('wheel', handleWheel);
      };
    }
  }, [currentRowIndex, sortedResults.length, searchType]);

  useEffect(() => {
    setCurrentRowIndex(0);
  }, [searchResults]);

  const trackRows = [];
  for (let i = 0; i < sortedResults.length; i += 3) {
    trackRows.push(sortedResults.slice(i, i + 3));
  }

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

  // Обработчик поиска с учетом типа поиска
  const handleSearchSubmit = async (query) => {
    if (searchType === 'tracks') {
      onSearch(query);
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
          {searchType === 'tracks' && wasSearched && searchResults.length > 0 && (
            <div className="platform-filter">
              <button
                className={`filter-button ${platformFilter === 'all' ? 'active' : ''}`}
                onClick={() => handleFilterChange('all')}
              >
                Все треки
              </button>
              <button
                className={`filter-button ${platformFilter === 'soundcloud' ? 'active' : ''}`}
                onClick={() => handleFilterChange('soundcloud')}
              >
                SoundCloud
              </button>
              <button
                className={`filter-button ${platformFilter === 'youtube' ? 'active' : ''}`}
                onClick={() => handleFilterChange('youtube')}
              >
                YouTube
              </button>
              {searchResults.some(track => track.platform === 'vkmusic') && (
                <button
                  className={`filter-button ${platformFilter === 'vkmusic' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('vkmusic')}
                >
                  VK Music
                </button>
              )}
            </div>
          )}


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
                  <div
                    className="tracks-container"
                    style={{ transform: `translateY(-${currentRowIndex * rowHeight}px)` }}
                  >
                    {trackRows.map((row, rowIndex) => {
                      const isVisible = rowIndex >= currentRowIndex && rowIndex < currentRowIndex + 3;

                      return (
                        <div
                          key={`row-${rowIndex}`}
                          className="track-row"
                          style={{ opacity: isVisible ? 1 : 0 }}
                        >
                          {row.map((track) => {
                            const trackIsUnavailable = isTrackUnavailable(track);
                            const trackIsLiked = isTrackLiked(track);

                            return (
                              <div key={`${track.platform}-${track.id}`} className="track-item">
                                <Component
                                  track={track}
                                  onClick={() => handleTrackClick(track)}
                                  isUnavailable={trackIsUnavailable}
                                  isLiked={trackIsLiked}
                                  onLike={() => handleLikeTrack(track)}
                                  onAddToPlaylist={() => handleAddToPlaylist(track)}
                                />
                              </div>
                            );
                          })}
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