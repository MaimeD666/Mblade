import React, { useState } from 'react';
import './SearchPlaylistCard.css';

function getTrackCountText(count) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'трек';
  } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return 'трека';
  } else {
    return 'треков';
  }
}

const PlaylistPreviewModal = ({ isOpen, playlist, onClose, onImport, onTrackPlay }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [visibleTracks, setVisibleTracks] = useState(10);

  if (!isOpen || !playlist) return null;

  const handleImport = async () => {
    setIsImporting(true);
    await onImport(playlist);
    setIsImporting(false);
  };

  const loadMoreTracks = () => {
    setVisibleTracks(prev => Math.min(prev + 10, playlist.tracks.length));
  };

  const showAllTracks = () => {
    setVisibleTracks(playlist.tracks.length);
  };

  return (
    <div className="modal-overlay playlist-preview-modal">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <h3 className="modal-title">{playlist.title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="playlist-preview-info">
          <div className="playlist-preview-details">
            <div className="playlist-meta">
              <span className="playlist-track-count">
                {playlist.tracks.length} {getTrackCountText(playlist.tracks.length)}
              </span>
              {playlist.author && (
                <span className="playlist-author">Автор: {playlist.author}</span>
              )}
            </div>
          </div>

          {playlist.thumbnail && (
            <div className="playlist-preview-image">
              <img src={playlist.thumbnail} alt={playlist.title} />
            </div>
          )}
        </div>

        <div className="playlist-tracks-preview">
          <h4 className="tracks-title">Треки в плейлисте:</h4>
          
          <div className="tracks-list">
            {playlist.tracks.slice(0, visibleTracks).map((track, index) => (
              <div key={`${track.id}-${index}`} className="preview-track-item">
                <div className="track-number">{index + 1}</div>
                
                <div className="track-thumbnail">
                  {track.thumbnail ? (
                    <img src={track.thumbnail} alt={track.title} />
                  ) : (
                    <div className="track-thumbnail-placeholder">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                      </svg>
                    </div>
                  )}
                </div>

                <div className="track-info">
                  <div className="track-title">{track.title}</div>
                  <div className="track-artist">{track.uploader || 'Неизвестный исполнитель'}</div>
                  {track.duration && (
                    <div className="track-duration">
                      {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                </div>

                <div className="track-actions">
                  <button 
                    className="track-play-button"
                    onClick={() => onTrackPlay(track)}
                    title="Воспроизвести трек"
                    title="Воспроизвести трек"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {visibleTracks < playlist.tracks.length && (
            <div className="load-more-section">
              <div className="remaining-tracks-info">
                Показано {visibleTracks} из {playlist.tracks.length} треков
              </div>
              <div className="load-more-buttons">
                <button className="load-more-button" onClick={loadMoreTracks}>
                  Показать еще 10
                </button>
                <button className="show-all-button" onClick={showAllTracks}>
                  Показать все
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="modal-button modal-button-cancel" onClick={onClose}>
            Закрыть
          </button>
          <button 
            className="modal-button modal-button-confirm"
            onClick={handleImport}
            disabled={isImporting}
          >
            {isImporting ? 'Импортируем...' : 'Импортировать плейлист'}
          </button>
        </div>
      </div>
    </div>
  );
};

const SearchPlaylistCard = ({ playlist, onPreview, onImport, onTrackPlay }) => {
  const [isImporting, setIsImporting] = useState(false);

  const handleQuickImport = async (e) => {
    e.stopPropagation();
    setIsImporting(true);
    await onImport(playlist);
    setIsImporting(false);
  };

  const getPlaylistCover = () => {
    if (playlist.thumbnail) {
      return (
        <div className="search-playlist-cover">
          <img src={playlist.thumbnail} alt={playlist.title} />
        </div>
      );
    }

    // Для быстрого поиска треки могут быть пустыми, используем только основную обложку
    if (playlist.tracks && playlist.tracks.length > 0) {
      const tracksWithThumbnails = playlist.tracks.filter(track => track.thumbnail);
      
      if (tracksWithThumbnails.length >= 4) {
        return (
          <div className="search-playlist-cover collage">
            <div className="cover-collage">
              {tracksWithThumbnails.slice(0, 4).map((track, index) => (
                <div
                  key={index}
                  className={`collage-image collage-image-${index + 1}`}
                  style={{ backgroundImage: `url(${track.thumbnail})` }}
                />
              ))}
              <div className="collage-overlay"></div>
            </div>
          </div>
        );
      } else if (tracksWithThumbnails.length > 0) {
        return (
          <div className="search-playlist-cover">
            <img src={tracksWithThumbnails[0].thumbnail} alt={playlist.title} />
          </div>
        );
      }
    }

    return (
      <div className="search-playlist-cover empty">
        <div className="playlist-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="search-playlist-card" onClick={() => onPreview(playlist)}>
      <div className="search-playlist-image">
        {getPlaylistCover()}
        <div className="playlist-platform-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027c-.302-.024-.526-.03-1 .122v5.689c.446.143.636.138 1 .138v-5.949z" />
          </svg>
        </div>
      </div>

      <div className="search-playlist-info">
        <div className="search-playlist-title">{playlist.title}</div>
        {playlist.author && (
          <div className="search-playlist-author">от {playlist.author}</div>
        )}
        <div className="search-playlist-stats">
          {playlist.track_count || playlist.tracks.length} {getTrackCountText(playlist.track_count || playlist.tracks.length)}
        </div>
      </div>

      <div className="search-playlist-actions" onClick={(e) => e.stopPropagation()}>
        <button 
          className="quick-import-button"
          onClick={handleQuickImport}
          disabled={isImporting}
          title="Быстрый импорт"
        >
          {isImporting ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="loading-icon">
              <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,9H15L12,12L9,9H13V3H11V9H5L12,16L19,9Z"/>
            </svg>
          )}
        </button>
        <button 
          className="preview-button"
          onClick={() => onPreview(playlist)}
          title="Просмотреть плейлист"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export { SearchPlaylistCard, PlaylistPreviewModal };