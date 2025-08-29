import React, { useState, useEffect, useRef, useMemo } from 'react';
import './HorizontalPlayer.css';
import { setCurrentTrack, downloadTrack } from '../services/api';
import FullscreenPlayer from './FullscreenPlayer';

const REPEAT_MODES = {
  NONE: 'none',
  TRACK: 'track',
  PLAYLIST: 'playlist'
};

const AddToPlaylistModal = ({ isOpen, track, playlists, onClose, onAddToPlaylists, onCreateNewPlaylist }) => {
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedPlaylists([]);
      setShowCreateNew(false);
      setNewPlaylistName('');
    }
  }, [isOpen]);

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
    onClose();
  };

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      onCreateNewPlaylist(newPlaylistName, track);
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

const OptionsModal = ({
  isOpen,
  onClose,
  repeatMode,
  onRepeatChange,
  isCustomQueueActive,
  onClearCustomQueue,
  currentTrack,
  onShareTrack,
  onOpenEqualizer
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay options-modal">
      <div className="modal-content">
        <h3 className="modal-title">Дополнительные опции</h3>

        <div className="options-list">
          <div
            className="option-item"
            onClick={() => {
              onShareTrack();
              onClose();
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
              onOpenEqualizer();
              onClose();
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

          {isCustomQueueActive && (
            <div
              className="option-item"
              onClick={() => {
                onClearCustomQueue();
                onClose();
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
              onRepeatChange(REPEAT_MODES.NONE);
              onClose();
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
              onRepeatChange(REPEAT_MODES.TRACK);
              onClose();
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
              onRepeatChange(REPEAT_MODES.PLAYLIST);
              onClose();
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
          <div className="modal-button modal-button-confirm" onClick={onClose}>
            Закрыть
          </div>
        </div>
      </div>
    </div>
  );
};

const ShareModal = ({ isOpen, onClose, url, trackTitle, trackAuthor, onCopy, copySuccess }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Поделиться треком</h3>
        <p className="modal-text">
          {trackTitle && trackAuthor ?
            `Поделитесь треком "${trackTitle}" от ${trackAuthor}` :
            'Поделитесь этим треком'}
        </p>

        <div className="share-link-container">
          <input
            type="text"
            value={url}
            readOnly
            className="playlist-name-input share-url-input"
            onClick={(e) => e.target.select()}
          />
          <button
            className={`share-copy-button ${copySuccess ? 'success' : ''}`}
            onClick={onCopy}
          >
            {copySuccess ? 'Скопировано!' : 'Копировать'}
          </button>
        </div>

        <div className="share-options">
          <div className="share-option telegram" title="Поделиться в Telegram" onClick={() => {
            window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Послушай "${trackTitle}" от ${trackAuthor}`)}`);
          }}>
            <div className="share-option-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 10.38 15.84 14.22 15.51 15.99C15.37 16.74 15.09 16.99 14.83 17.02C14.25 17.07 13.81 16.64 13.25 16.27C12.37 15.69 11.87 15.33 11.02 14.77C10.03 14.12 10.67 13.76 11.24 13.18C11.39 13.03 13.95 10.7 14 10.49C14.0069 10.4582 14.006 10.4252 13.9973 10.3938C13.9886 10.3624 13.9724 10.3337 13.95 10.31C13.89 10.26 13.81 10.28 13.74 10.29C13.65 10.31 12.15 11.34 9.24 13.39C8.78 13.7 8.37 13.85 8 13.84C7.59 13.83 6.81 13.62 6.22 13.43C5.5 13.21 4.92 13.09 4.97 12.71C4.99 12.51 5.28 12.31 5.83 12.11C8.94 10.73 11.05 9.81 12.16 9.35C15.37 7.99 16.07 7.72 16.5 7.72C16.59 7.72 16.78 7.74 16.9 7.84C17 7.92 17.03 8.03 17.04 8.11C17.03 8.17 17.05 8.34 16.64 8.8Z" fill="#33a8e3" />
              </svg>
            </div>
            <span>Telegram</span>
          </div>

          <div className="share-option whatsapp" title="Поделиться в WhatsApp" onClick={() => {
            window.open(`https://wa.me/?text=${encodeURIComponent(`Послушай "${trackTitle}" от ${trackAuthor}: ${url}`)}`);
          }}>
            <div className="share-option-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.53 15.4C16.33 15.99 15.4 16.5 14.74 16.65C14.3 16.75 13.73 16.83 11.28 15.83C8.27 14.64 6.31 11.58 6.17 11.4C6.03 11.22 5 9.85 5 8.43C5 7.01 5.73 6.31 5.97 6.05C6.18 5.83 6.49 5.73 6.79 5.73C6.89 5.73 6.99 5.73 7.07 5.74C7.31 5.75 7.45 5.76 7.62 6.16C7.83 6.67 8.35 8.09 8.42 8.24C8.49 8.39 8.56 8.59 8.46 8.78C8.37 8.98 8.29 9.07 8.14 9.24C7.99 9.41 7.85 9.54 7.7 9.73C7.57 9.89 7.42 10.07 7.6 10.36C7.78 10.65 8.35 11.58 9.2 12.34C10.31 13.33 11.23 13.64 11.56 13.77C11.8 13.87 12.09 13.85 12.26 13.67C12.48 13.44 12.74 13.06 13.01 12.69C13.21 12.42 13.46 12.38 13.73 12.49C14.01 12.59 15.42 13.28 15.72 13.43C16.02 13.58 16.22 13.65 16.29 13.77C16.36 13.89 16.36 14.41 16.53 15.4Z" fill="#25d366" />
              </svg>
            </div>
            <span>WhatsApp</span>
          </div>

          <div className="share-option vk" title="Поделиться ВКонтакте" onClick={() => {
            window.open(`https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(trackTitle)}&description=${encodeURIComponent(`Трек от ${trackAuthor}`)}`);
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
          <div className="modal-button modal-button-confirm" onClick={onClose}>
            Закрыть
          </div>
        </div>
      </div>
    </div>
  );
};

const PlayerIcons = {
  play: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5.14V19.14C8 19.94 8.85 20.44 9.54 20.05L20.54 13.05C21.15 12.71 21.15 11.81 20.54 11.47L9.54 4.47C8.85 4.08 8 4.58 8 5.14Z" fill="white" />
    </svg>
  ),
  pause: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 19H10V5H6V19ZM14 5V19H18V5H14Z" fill="white" />
    </svg>
  ),
  prev: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="white" />
    </svg>
  ),
  next: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" fill="white" />
    </svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.59 9H15V4C15 3.45 14.55 3 14 3H10C9.45 3 9 3.45 9 4V9H7.41C6.52 9 6.08 10.08 6.71 10.71L11.3 15.3C11.69 15.69 12.32 15.69 12.71 15.3L17.3 10.71C17.92 10.08 17.48 9 16.59 9ZM5 19C5 19.55 5.45 20 6 20H18C18.55 20 19 19.55 19 19C19 18.45 18.55 18 18 18H6C5.45 18 5 18.45 5 19Z" fill="white" />
    </svg>
  ),
  like: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" fill="white" />
    </svg>
  ),
  liked: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" fill="#ff5e94" />
    </svg>
  ),
  playlist: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 17H12V19H2V17ZM2 5H22V7H2V5ZM2 11H22V13H2V11ZM17.35 21.41L16.29 20.35L18.64 18H15V16H18.64L16.29 13.65L17.35 12.59L21.77 17L17.35 21.41Z" fill="white" />
    </svg>
  ),
  more: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 8C13.1 8 14 7.1 14 6C14 4.9 13.1 4 12 4C10.9 4 10 4.9 10 6C10 7.1 10.9 8 12 8ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10ZM12 16C10.9 16 10 16.9 10 18C10 19.1 10.9 20 12 20C13.1 20 14 19.1 14 18C14 16.9 13.1 16 12 16Z" fill="white" />
    </svg>
  ),
  repeatTrack: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill="#64e0ff" />
      <circle cx="18" cy="18" r="6" fill="rgba(0,0,0,0.5)" />
      <text x="18" y="21" textAnchor="middle" fontSize="8" fill="#64e0ff">1</text>
    </svg>
  ),
  repeatPlaylist: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" fill="#64e0ff" />
      <path d="M14 12l-3 0v-2l-4 3 4 3v-2h3v-2z" fill="#64e0ff" fillOpacity="0.8" />
    </svg>
  ),
  volume: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="white" />
    </svg>
  )
};

const HorizontalPlayer = ({
  currentTrack,
  isPlaying,
  setIsPlaying,
  audioRef,
  isLiked,
  toggleLike,
  playlists,
  createPlaylist,
  addTrackToPlaylists,
  onPrevTrack,
  onNextTrack,
  hasNext,
  hasPrev,
  repeatMode,
  setRepeatMode,
  isLoading,
  shuffleMode,
  toggleShuffleMode,
  isCustomQueueActive,
  clearCustomQueue,
  onSyncTrack,
  onSyncPlayback,
  onOpenEqualizer,
  onShowPlaylistModal,
  onShowOptionsModal,
  onShowShareModal
}) => {
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [buttonPulse, setButtonPulse] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloadReady, setIsDownloadReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const progressInterval = useRef(null);
  const progressBarRef = useRef(null);
  const volumeBarRef = useRef(null);
  const lastTrackIdRef = useRef(null);

  useEffect(() => {
    if (currentTrack && isFirstLoad) {
      setIsFirstLoad(false);
    }
  }, [currentTrack, isFirstLoad]);

  useEffect(() => {
    if (currentTrack) {
      setCurrentTrack(currentTrack).catch(e => {
        console.warn('Не удалось обновить информацию о текущем треке:', e);
      });
    }
  }, [currentTrack]);

  useEffect(() => {
    if (currentTrack && lastTrackIdRef.current !== `${currentTrack.platform}-${currentTrack.id}`) {
      setProgress(0);
      setCurrentTime(0);
      setDownloadProgress(0);
      setIsDownloadReady(false);
      setIsDownloading(false);
      lastTrackIdRef.current = `${currentTrack.platform}-${currentTrack.id}`;
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!audioRef.current) return;

    const handleLoadStart = () => {
      setDownloadProgress(0);
      setIsDownloadReady(false);
    };

    const handleProgress = () => {
      if (audioRef.current && audioRef.current.buffered.length > 0) {
        const buffered = audioRef.current.buffered.end(audioRef.current.buffered.length - 1);
        const duration = audioRef.current.duration || currentTrack?.duration || 1;
        const progress = (buffered / duration) * 100;
        setDownloadProgress(Math.min(progress, 100));
      }
    };

    const handleCanPlayThrough = () => {
      setDownloadProgress(100);
      setIsDownloadReady(true);
    };

    const handleLoadedData = () => {
      setDownloadProgress(25);
    };

    const handleCanPlay = () => {
      setDownloadProgress(75);
    };

    audioRef.current.addEventListener('loadstart', handleLoadStart);
    audioRef.current.addEventListener('progress', handleProgress);
    audioRef.current.addEventListener('canplaythrough', handleCanPlayThrough);
    audioRef.current.addEventListener('loadeddata', handleLoadedData);
    audioRef.current.addEventListener('canplay', handleCanPlay);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('loadstart', handleLoadStart);
        audioRef.current.removeEventListener('progress', handleProgress);
        audioRef.current.removeEventListener('canplaythrough', handleCanPlayThrough);
        audioRef.current.removeEventListener('loadeddata', handleLoadedData);
        audioRef.current.removeEventListener('canplay', handleCanPlay);
      }
    };
  }, [audioRef, currentTrack]);

  useEffect(() => {
    if (currentTrack) {
      if (currentTrack.actualDuration && isFinite(currentTrack.actualDuration)) {
        setDuration(currentTrack.actualDuration);
      } else if (currentTrack.duration && isFinite(currentTrack.duration)) {
        setDuration(currentTrack.duration);
      }
    }
  }, [currentTrack]);

  useEffect(() => {
    if (!audioRef.current) return;

    const handleTrackEnded = () => {
      if (repeatMode === REPEAT_MODES.TRACK) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(err => console.error(err));
      } else if (repeatMode === REPEAT_MODES.PLAYLIST) {
        onNextTrack();
      } else {
        if (hasNext) onNextTrack();
      }
    };

    audioRef.current.addEventListener('ended', handleTrackEnded);
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleTrackEnded);
      }
    };
  }, [audioRef, repeatMode, onNextTrack, hasNext]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleShareTrack = async () => {
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

    setShareUrl(url);

    if (navigator.share && url) {
      navigator.share({
        title: currentTrack.title,
        text: `Послушай "${currentTrack.title}" от ${currentTrack.uploader}`,
        url: url
      })
        .then(() => console.log('Контент успешно отправлен'))
        .catch((error) => {
          console.log('Ошибка отправки:', error);
          if (onShowShareModal) onShowShareModal();
        });
    } else {
      if (onShowShareModal) onShowShareModal();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('Не удалось скопировать текст: ', err);
      });
  };

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds) || seconds < 0) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}:${remainingMins < 10 ? '0' : ''}${remainingMins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    if (isPlaying && audioRef.current && !isDraggingProgress) {
      progressInterval.current = setInterval(() => {
        if (!audioRef.current) return;

        const audioDuration = audioRef.current.duration ||
          currentTrack?.actualDuration ||
          currentTrack?.duration ||
          1;

        const currentTime = audioRef.current.currentTime || 0;

        if (audioDuration <= 0 || !isFinite(audioDuration)) {
          return;
        }

        setCurrentTime(currentTime);

        if (isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
          setDuration(audioRef.current.duration);
        }

        if (!isDraggingProgress) {
          const progressPercent = (currentTime / audioDuration) * 100;
          setProgress(Math.max(0, Math.min(progressPercent, 100)));
        }
      }, 50);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
  }, [isPlaying, audioRef, isDraggingProgress, currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume, audioRef]);

  useEffect(() => {
    if (!audioRef.current) return;

    const syncPlayState = () => {
      const audioIsPlaying = !audioRef.current.paused;
      if (isPlaying !== audioIsPlaying) {
        setIsPlaying(audioIsPlaying);
      }
    };

    audioRef.current.addEventListener('play', syncPlayState);
    audioRef.current.addEventListener('pause', syncPlayState);
    audioRef.current.addEventListener('ended', syncPlayState);
    audioRef.current.addEventListener('canplay', syncPlayState);

    syncPlayState();

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', syncPlayState);
        audioRef.current.removeEventListener('pause', syncPlayState);
        audioRef.current.removeEventListener('ended', syncPlayState);
        audioRef.current.removeEventListener('canplay', syncPlayState);
      }
    };
  }, [audioRef, isPlaying, setIsPlaying]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingProgress && progressBarRef.current) {
        progressBarRef.current.classList.remove('dragging');
      }
      if (isDraggingVolume && volumeBarRef.current) {
        volumeBarRef.current.classList.remove('dragging');
      }

      setIsDraggingProgress(false);
      setIsDraggingVolume(false);
    };

    const handleMouseMove = (e) => {
      if (isDraggingProgress) {
        handleProgressUpdate(e);
      }
      if (isDraggingVolume) {
        handleVolumeUpdate(e);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDraggingProgress, isDraggingVolume]);

  const canSeek = useMemo(() => {
    const hasValidDuration = (audioRef.current &&
      isFinite(audioRef.current.duration) &&
      audioRef.current.duration > 0) ||
      (currentTrack?.actualDuration &&
        isFinite(currentTrack.actualDuration));

    return currentTrack &&
      !currentTrack.isTranscoding &&
      hasValidDuration;
  }, [currentTrack, audioRef.current?.duration]);

  const handleProgressUpdate = (e) => {
    if (!audioRef.current || !progressBarRef.current) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min((offsetX / rect.width) * 100, 100));

    const audioDuration = audioRef.current.duration ||
      currentTrack?.actualDuration ||
      currentTrack?.duration ||
      0;

    if (audioDuration && isFinite(audioDuration) && canSeek) {
      if (progressBarRef.current) {
        progressBarRef.current.classList.add('buffering');
      }

      const onBuffering = () => {
        if (audioRef.current.readyState >= 3) {
          if (progressBarRef.current) {
            progressBarRef.current.classList.remove('buffering');
          }
          audioRef.current.removeEventListener('progress', onBuffering);
          audioRef.current.removeEventListener('canplay', onBuffering);
        }
      };

      audioRef.current.addEventListener('progress', onBuffering);
      audioRef.current.addEventListener('canplay', onBuffering);

      audioRef.current.currentTime = (percent / 100) * audioDuration;
      setCurrentTime(audioRef.current.currentTime);
      setProgress(percent);
    }
  };

  const handleVolumeUpdate = (e) => {
    if (!volumeBarRef.current) return;

    const rect = volumeBarRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const maxX = rect.width;
    const boundedOffsetX = Math.max(0, Math.min(offsetX, maxX));
    const percent = (boundedOffsetX / maxX) * 100;

    setVolume(percent);
    if (audioRef.current) {
      audioRef.current.volume = percent / 100;
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error('Ошибка воспроизведения:', err);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }

      setButtonPulse(true);
      setTimeout(() => setButtonPulse(false), 300);
    }
  };

  const handleAddToPlaylist = () => {
    if (!currentTrack) return;
    if (onShowPlaylistModal) onShowPlaylistModal();
  };

  const handleShowOptions = () => {
    if (!currentTrack) return;
    if (onShowOptionsModal) onShowOptionsModal();
  };

  const handlePrevTrack = () => {
    if (hasPrev && onPrevTrack) {
      setButtonPulse(true);
      setTimeout(() => setButtonPulse(false), 300);
      onPrevTrack();
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleNextTrack = () => {
    if (hasNext && onNextTrack) {
      setButtonPulse(true);
      setTimeout(() => setButtonPulse(false), 300);
      onNextTrack();
    }
  };

  const handleDownload = async () => {
    if (!currentTrack || !isDownloadReady || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadTrack(currentTrack);
    } catch (error) {
      console.error('Ошибка скачивания:', error);
    } finally {
      setTimeout(() => {
        setIsDownloading(false);
      }, 2000);
    }
  };

  const getAdditionalButtonIcon = () => {
    switch (repeatMode) {
      case REPEAT_MODES.TRACK:
        return PlayerIcons.repeatTrack;
      case REPEAT_MODES.PLAYLIST:
        return PlayerIcons.repeatPlaylist;
      case REPEAT_MODES.NONE:
      default:
        return PlayerIcons.more;
    }
  };

  const actuallyPlaying = audioRef.current ? !audioRef.current.paused : isPlaying;

  const playerClasses = `horizontal-music-player ${!currentTrack ? 'player-empty' : ''} ${currentTrack && isFirstLoad ? 'first-track-loaded' : ''}`;

  const additionalButtonClass = `additional ${repeatMode !== REPEAT_MODES.NONE ? 'repeat-active' : ''}`;

  const downloadButtonClass = `download ${!currentTrack || !isDownloadReady || isDownloading ? 'disabled' : ''}`;

  return (
    <div className={playerClasses}>
      <div className="horizontal-player-container">
        {/* Управление треком */}
        <div className="horizontal-controls">
          <div className="player-panel">
            <button
              className={`control-button prev-button ${!hasPrev ? 'disabled' : ''}`}
              onClick={handlePrevTrack}
              disabled={!hasPrev}
              title="Предыдущий трек"
            >
              {PlayerIcons.prev}
            </button>

            <button
              className={`control-button play-button ${buttonPulse ? 'pulse' : ''} ${actuallyPlaying ? 'is-playing' : ''}`}
              onClick={togglePlayPause}
              title={actuallyPlaying ? 'Пауза' : 'Воспроизведение'}
            >
              {actuallyPlaying ? PlayerIcons.pause : PlayerIcons.play}
            </button>

            <button
              className={`control-button next-button ${!hasNext ? 'disabled' : ''}`}
              onClick={handleNextTrack}
              disabled={!hasNext}
              title="Следующий трек"
            >
              {PlayerIcons.next}
            </button>
          </div>
        </div>

        {/* Информация о треке */}
        <div className="horizontal-track-info">
          <div className="player-panel">
            <div className="track-image-container">
              <div
                className={`track-image ${!currentTrack ? 'track-image-empty' : ''} ${isLoading ? 'track-image-loading' : ''}`}
                onClick={currentTrack ? toggleFullscreen : undefined}
                style={currentTrack ? { cursor: 'pointer' } : {}}
              >
                {currentTrack?.thumbnail && (
                  <img src={currentTrack.thumbnail} alt={currentTrack.title} />
                )}
                {isLoading && <div className="loading-spinner" />}
              </div>
            </div>

            <div className="track-details">
              <div className="track-title">
                {currentTrack ? currentTrack.title : 'Нет трека'}
              </div>
              <div className="track-artist">
                {currentTrack
                  ? (currentTrack.uploader || currentTrack.artist)
                  : 'Выберите трек для воспроизведения'}
              </div>
            </div>
          </div>
        </div>

        {/* Прогресс и время */}
        <div className="horizontal-progress-section">
          <div className="player-panel">
            <span className="current-time">{formatTime(currentTime)}</span>
            <div
              className={`progress-bar ${!canSeek ? 'disabled' : ''}`}
              ref={progressBarRef}
              onClick={canSeek ? handleProgressUpdate : undefined}
              onMouseDown={
                canSeek
                  ? (e) => {
                      setIsDraggingProgress(true);
                      progressBarRef.current.classList.add('dragging');
                      handleProgressUpdate(e);
                    }
                  : undefined
              }
              style={!canSeek ? { cursor: 'not-allowed' } : {}}
            >
              <div className="progress-fill" style={{ width: `${progress}%` }}>
                <div className="progress-handle" />
              </div>
            </div>
            <span className="duration">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Действия */}
        <div className="horizontal-actions">
          <div className="player-panel">
            <button
              className="action-button like-button"
              onClick={toggleLike}
              disabled={!currentTrack}
              title={isLiked ? 'Удалить из любимых' : 'Добавить в любимые'}
            >
              {isLiked ? PlayerIcons.liked : PlayerIcons.like}
            </button>

            <button
              className="action-button playlist-button"
              onClick={handleAddToPlaylist}
              disabled={!currentTrack}
              title="Добавить в плейлист"
            >
              {PlayerIcons.playlist}
            </button>

            <button
              className="action-button download-button"
              onClick={handleDownload}
              title="Скачать трек"
            >
              {PlayerIcons.download}
            </button>

            <button
              className="action-button options-button"
              onClick={handleShowOptions}
              title="Дополнительные опции"
            >
              {PlayerIcons.more}
            </button>
          </div>
        </div>

        {/* Громкость */}
        <div className="horizontal-volume">
          <div className="player-panel">
            <div className="volume-icon">
              {PlayerIcons.volume}
            </div>
            <div
              className="volume-slider"
              ref={volumeBarRef}
              onClick={handleVolumeUpdate}
              onMouseDown={(e) => {
                setIsDraggingVolume(true);
                volumeBarRef.current.classList.add('dragging');
                handleVolumeUpdate(e);
              }}
            >
              <div className="volume-fill" style={{ width: `${volume}%` }}>
                <div className="volume-handle" />
              </div>
            </div>
          </div>
        </div>

        {/* Транскодирование overlay */}
        {currentTrack?.isTranscoding && (
          <div className="transcoding-overlay">
            <div className="transcoding-container">
              <div className="transcoding-label">Транскодирование...</div>
              <div className="transcoding-progress-container">
                <div
                  className="transcoding-progress-bar"
                  style={{ width: `${currentTrack.transcodingProgress || 0}%` }}
                />
              </div>
              <div className="transcoding-percentage">
                {currentTrack.transcodingProgress || 0}%
              </div>
            </div>
          </div>
        )}
      </div>


      {/* Полноэкранный режим */}
      {isFullscreen && currentTrack && (
        <FullscreenPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          togglePlayPause={togglePlayPause}
          onPrevTrack={handlePrevTrack}
          onNextTrack={handleNextTrack}
          progress={progress}
          volume={volume}
          formatTime={formatTime}
          currentTime={currentTime}
          duration={duration}
          onClose={toggleFullscreen}
          hasPrev={hasPrev}
          hasNext={hasNext}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};

export default HorizontalPlayer;