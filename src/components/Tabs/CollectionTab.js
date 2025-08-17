// src/components/Tabs/CollectionTab.js
import React, { useState, useRef, useEffect } from 'react';
import './CollectionTab.css';
import { importSoundCloudPlaylist } from '../../services/api';

// Вспомогательная функция для склонения слова "трек"
function getTrackCountText(count) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'трек';
  } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return 'трека';
  } else {
    return 'треков';
  }
}

// Компонент контекстного меню для треков
// Компонент контекстного меню для треков
const TrackContextMenu = ({ isOpen, buttonRef, track, onClose, onPlayNext, onAddToQueue }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    // Добавляем проверку на существование самого buttonRef
    if (isOpen && menuRef.current && buttonRef && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      // Получаем текущий scale из приложения
      const appElement = document.querySelector('.div');
      let scale = 1;

      if (appElement) {
        const transform = window.getComputedStyle(appElement).transform;
        const matrix = transform.match(/^matrix\((.+)\)$/);
        if (matrix) {
          scale = parseFloat(matrix[1].split(', ')[0]);
        }
      }

      // Расчет позиции с учетом масштабирования
      const top = buttonRect.bottom / scale;
      const left = (buttonRect.left + (buttonRect.width - menuRect.width) / 2) / scale;

      // Проверяем границы экрана
      const viewport = {
        width: window.innerWidth / scale,
        height: window.innerHeight / scale
      };

      let adjustedTop = top;
      let adjustedLeft = left;

      if (left + menuRect.width > viewport.width) {
        adjustedLeft = viewport.width - menuRect.width - 10 / scale;
      }

      if (top + menuRect.height > viewport.height) {
        adjustedTop = (buttonRect.top - menuRect.height) / scale;
      }

      menuRef.current.style.position = 'absolute';
      menuRef.current.style.top = `${adjustedTop}px`;
      menuRef.current.style.left = `${adjustedLeft}px`;
      menuRef.current.style.zIndex = '1000';
    }
  }, [isOpen, buttonRef]);

  if (!isOpen || !track) return null;

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose}></div>
      <div className="track-context-menu" ref={menuRef}>
        <div className="context-menu-item" onClick={() => { onPlayNext && onPlayNext(track); onClose(); }}>
          <span className="context-menu-icon">⏭</span>
          <span className="context-menu-text">Воспроизвести следующим</span>
        </div>
        <div className="context-menu-item" onClick={() => { onAddToQueue && onAddToQueue(track); onClose(); }}>
          <span className="context-menu-icon">➕</span>
          <span className="context-menu-text">Добавить в конец очереди</span>
        </div>
      </div>
    </>
  );
};

// Модальное окно подтверждения (используется для удаления плейлиста)
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">{title}</h3>
        <p className="modal-text">{message}</p>
        <div className="modal-buttons">
          <div className="modal-button modal-button-cancel" onClick={onCancel}>
            Отмена
          </div>
          <div className="modal-button modal-button-confirm" onClick={onConfirm}>
            Подтвердить
          </div>
        </div>
      </div>
    </div>
  );
};

// Модальное окно создания плейлиста
const CreatePlaylistModal = ({ isOpen, onClose, onConfirm }) => {
  const [playlistName, setPlaylistName] = useState('');

  if (!isOpen) return null;

  const handleCreate = () => {
    if (playlistName.trim()) {
      onConfirm(playlistName);
      setPlaylistName('');
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Создать новый плейлист</h3>
        <div className="playlist-input-container">
          <input
            type="text"
            className="playlist-name-input"
            placeholder="Название плейлиста"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-buttons">
          <div className="modal-button modal-button-cancel" onClick={onClose}>
            Отмена
          </div>
          <div
            className="modal-button modal-button-confirm"
            onClick={handleCreate}
            style={{ opacity: playlistName.trim() ? 1 : 0.5 }}
          >
            Создать
          </div>
        </div>
      </div>
    </div>
  );
};

// Модальное окно добавления трека в плейлист
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

// Модальное окно экспорта плейлистов
const ExportPlaylistsModal = ({ isOpen, playlists, onClose, onExport }) => {
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);

  if (!isOpen) return null;

  const togglePlaylist = (playlistId) => {
    if (selectedPlaylists.includes(playlistId)) {
      setSelectedPlaylists(selectedPlaylists.filter(id => id !== playlistId));
    } else {
      setSelectedPlaylists([...selectedPlaylists, playlistId]);
    }
  };

  const handleExport = () => {
    if (selectedPlaylists.length === 0) return;
    onExport(selectedPlaylists);
    setSelectedPlaylists([]);
    onClose();
  };

  const toggleSelectAll = () => {
    if (selectedPlaylists.length === playlists.length) {
      setSelectedPlaylists([]);
    } else {
      setSelectedPlaylists(playlists.map(playlist => playlist.id));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Экспорт плейлистов</h3>

        {playlists.length > 0 ? (
          <>
            <div
              className="playlist-selection-item"
              onClick={toggleSelectAll}
              style={{ backgroundColor: 'rgba(var(--accent-color-rgb, 181, 58, 212), 0.2)' }}
            >
              <div className={`playlist-selection-checkbox ${selectedPlaylists.length === playlists.length ? 'checked' : ''}`} />
              <div className="playlist-selection-name">Выбрать все</div>
            </div>

            <div className="playlist-selection-list">
              {playlists.map(playlist => (
                <div
                  key={playlist.id}
                  className="playlist-selection-item"
                  onClick={() => togglePlaylist(playlist.id)}
                >
                  <div className={`playlist-selection-checkbox ${selectedPlaylists.includes(playlist.id) ? 'checked' : ''}`} />
                  <div className="playlist-selection-name">
                    {playlist.name} ({playlist.tracks.length} {getTrackCountText(playlist.tracks.length)})
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="modal-text">У вас еще нет плейлистов.</p>
        )}

        <div className="modal-buttons">
          <div className="modal-button modal-button-cancel" onClick={onClose}>
            Отмена
          </div>
          <div
            className="modal-button modal-button-confirm"
            onClick={handleExport}
            style={{ opacity: selectedPlaylists.length ? 1 : 0.5 }}
          >
            Экспортировать
          </div>
        </div>
      </div>
    </div>
  );
};

// Модальное окно редактирования плейлиста
const EditPlaylistModal = ({ isOpen, playlist, onClose, onSave }) => {
  const [playlistName, setPlaylistName] = useState(playlist?.name || '');
  const [customCover, setCustomCover] = useState(playlist?.customCover || null);
  const [previewImage, setPreviewImage] = useState(playlist?.customCover || null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (playlist) {
      setPlaylistName(playlist.name || '');
      setCustomCover(playlist.customCover || null);
      setPreviewImage(playlist.customCover || null);
    }
  }, [playlist]);

  if (!isOpen || !playlist) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Проверяем, что файл - изображение
    if (!file.type.match('image.*')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    // Создаем превью
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
      setCustomCover(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!playlistName.trim()) return;

    onSave(playlist.id, {
      name: playlistName.trim(),
      customCover: customCover
    });

    onClose();
  };

  const handleRemoveCover = () => {
    setPreviewImage(null);
    setCustomCover(null);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content edit-playlist-modal">
        <h3 className="modal-title">Редактировать плейлист</h3>

        <div className="edit-sections">
          <div className="edit-section">
            <h4 className="edit-section-title">Название</h4>
            <input
              type="text"
              className="playlist-name-input"
              placeholder="Название плейлиста"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="edit-section">
            <h4 className="edit-section-title">Обложка</h4>

            <div className="cover-preview-container">
              {previewImage ? (
                <div className="custom-cover-preview">
                  <img src={previewImage} alt="Preview" className="cover-preview-image" />
                  <div className="remove-cover-button" onClick={handleRemoveCover}>
                    <span>✕</span>
                  </div>
                </div>
              ) : (
                <div className="cover-placeholder">
                  <span className="cover-placeholder-icon">🖼️</span>
                  <span className="cover-placeholder-text">По умолчанию будет использоваться коллаж из обложек треков</span>
                </div>
              )}
            </div>

            <div className="cover-buttons">
              <button className="cover-upload-button" onClick={() => fileInputRef.current.click()}>
                Загрузить изображение
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>

        <div className="modal-buttons">
          <div className="modal-button modal-button-cancel" onClick={onClose}>
            Отмена
          </div>
          <div
            className="modal-button modal-button-confirm"
            onClick={handleSave}
            style={{ opacity: playlistName.trim() ? 1 : 0.5 }}
          >
            Сохранить
          </div>
        </div>
      </div>
    </div>
  );
};

// Модальное окно комбинирования плейлистов
const CombinePlaylistsModal = ({ isOpen, playlists, onClose, onCombine }) => {
  const [selectedPlaylists, setSelectedPlaylists] = useState([]);
  const [combinedPlaylistName, setCombinedPlaylistName] = useState('');

  if (!isOpen) return null;

  // Генерация имени для комбинированного плейлиста
  const generateCombinedName = (playlistIds) => {
    const selectedPlaylistsData = playlists.filter(p => playlistIds.includes(p.id));
    if (selectedPlaylistsData.length === 0) return '';
    if (selectedPlaylistsData.length === 1) return selectedPlaylistsData[0].name;
    if (selectedPlaylistsData.length === 2) {
      return `${selectedPlaylistsData[0].name} + ${selectedPlaylistsData[1].name}`;
    }
    return `${selectedPlaylistsData[0].name} + ${selectedPlaylistsData[1].name} + еще ${selectedPlaylistsData.length - 2}`;
  };

  const togglePlaylist = (playlistId) => {
    let newSelected;
    if (selectedPlaylists.includes(playlistId)) {
      newSelected = selectedPlaylists.filter(id => id !== playlistId);
    } else {
      newSelected = [...selectedPlaylists, playlistId];
    }
    setSelectedPlaylists(newSelected);
    setCombinedPlaylistName(generateCombinedName(newSelected));
  };

  const handleCombine = () => {
    if (selectedPlaylists.length < 2) return;
    const finalName = combinedPlaylistName.trim() || generateCombinedName(selectedPlaylists);
    onCombine(selectedPlaylists, finalName);
    setSelectedPlaylists([]);
    setCombinedPlaylistName('');
    onClose();
  };

  const toggleSelectAll = () => {
    let newSelected;
    if (selectedPlaylists.length === playlists.length) {
      newSelected = [];
    } else {
      newSelected = playlists.map(playlist => playlist.id);
    }
    setSelectedPlaylists(newSelected);
    setCombinedPlaylistName(generateCombinedName(newSelected));
  };

  const totalTracks = selectedPlaylists.reduce((sum, playlistId) => {
    const playlist = playlists.find(p => p.id === playlistId);
    return sum + (playlist ? playlist.tracks.length : 0);
  }, 0);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="modal-title">Комбинировать плейлисты</h3>

        {playlists.length > 1 ? (
          <>
            <div className="combine-info" style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'rgba(var(--accent-color-rgb, 58, 181, 102), 0.1)', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: 'var(--text-color)' }}>
                Выбрано плейлистов: {selectedPlaylists.length} | Всего треков: {totalTracks}
              </p>
              {selectedPlaylists.length >= 2 && (
                <div style={{ marginTop: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: 'var(--text-color)' }}>
                    Название нового плейлиста:
                  </label>
                  <input
                    type="text"
                    className="playlist-name-input"
                    value={combinedPlaylistName}
                    onChange={(e) => setCombinedPlaylistName(e.target.value)}
                    placeholder={generateCombinedName(selectedPlaylists)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.3)', color: 'var(--text-color)' }}
                  />
                </div>
              )}
            </div>

            <div
              className="playlist-selection-item"
              onClick={toggleSelectAll}
              style={{ backgroundColor: 'rgba(var(--accent-color-rgb, 58, 181, 102), 0.2)' }}
            >
              <div className={`playlist-selection-checkbox ${selectedPlaylists.length === playlists.length ? 'checked' : ''}`} />
              <div className="playlist-selection-name">Выбрать все</div>
            </div>

            <div className="playlist-selection-list">
              {playlists.map(playlist => (
                <div
                  key={playlist.id}
                  className="playlist-selection-item"
                  onClick={() => togglePlaylist(playlist.id)}
                >
                  <div className={`playlist-selection-checkbox ${selectedPlaylists.includes(playlist.id) ? 'checked' : ''}`} />
                  <div className="playlist-selection-name">
                    {playlist.name} ({playlist.tracks.length} {getTrackCountText(playlist.tracks.length)})
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="modal-text">Для комбинирования нужно минимум 2 плейлиста.</p>
        )}

        <div className="modal-buttons">
          <div className="modal-button modal-button-cancel" onClick={onClose}>
            Отмена
          </div>
          <div
            className="modal-button modal-button-confirm"
            onClick={handleCombine}
            style={{ 
              opacity: selectedPlaylists.length >= 2 ? 1 : 0.5,
              backgroundColor: selectedPlaylists.length >= 2 ? 'rgba(var(--accent-color-rgb, 58, 181, 102), 0.7)' : undefined
            }}
          >
            Комбинировать
          </div>
        </div>
      </div>
    </div>
  );
};

// Модальное окно импорта плейлистов
const ImportPlaylistsModal = ({ isOpen, playlists, likedTracks, onClose, onImport, savePlaylistsToServer, setPlaylists }) => {
  const [importSource, setImportSource] = useState('file'); // 'file' или 'soundcloud'
  const [fileContent, setFileContent] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [soundcloudPlaylistUrl, setSoundcloudPlaylistUrl] = useState('');
  const [isImportingSoundcloud, setIsImportingSoundcloud] = useState(false);
  const [scPlaylistPreview, setScPlaylistPreview] = useState(null);

  if (!isOpen) return null;

  // Валидация плейлистов
  const validatePlaylists = (playlists) => {
    if (!Array.isArray(playlists)) return false;

    return playlists.every(playlist => {
      if (!playlist.name || typeof playlist.name !== 'string') return false;
      if (!Array.isArray(playlist.tracks)) return false;

      // Проверка на максимальный размер
      const estimatedSize = JSON.stringify(playlist).length;
      if (estimatedSize > 50 * 1024 * 1024) { // 50MB
        console.warn(`Плейлист ${playlist.name} слишком большой (${Math.round(estimatedSize / 1024 / 1024)}MB)`);
        return false;
      }

      return true;
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setError('');

    if (!file) {
      setFileContent(null);
      setFileName('');
      return;
    }

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setError('Пожалуйста, выберите файл формата JSON');
      setFileContent(null);
      setFileName('');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target.result);

        // Проверка на общий размер файла
        if (e.target.result.length > 100 * 1024 * 1024) { // 100MB
          setError('Файл слишком большой. Максимальный размер: 100MB');
          setFileContent(null);
          return;
        }

        const isValid = validatePlaylists(content);

        if (!isValid) {
          setError('Неверный формат плейлистов в файле или плейлисты слишком большие.');
          setFileContent(null);
          return;
        }

        // Проверка общего количества треков
        const totalTracks = content.reduce((total, playlist) =>
          total + (Array.isArray(playlist.tracks) ? playlist.tracks.length : 0), 0);

        if (totalTracks > 10000) {
          setError(`Файл содержит слишком много треков (${totalTracks}). Максимум: 10000.`);
          setFileContent(null);
          return;
        }

        setFileContent(content);
      } catch (error) {
        console.error('Ошибка при разборе файла:', error);
        setError('Ошибка при чтении файла. Убедитесь, что это валидный JSON.');
        setFileContent(null);
      }
    };
    reader.readAsText(file);
  };

  // Функция для предпросмотра плейлиста SoundCloud
  const previewSoundcloudPlaylist = async () => {
    if (!soundcloudPlaylistUrl) return;

    setError('');
    setIsImportingSoundcloud(true);
    setScPlaylistPreview(null);

    try {
      const response = await importSoundCloudPlaylist(soundcloudPlaylistUrl);

      if (response.playlist) {
        setScPlaylistPreview(response.playlist);
      }
    } catch (error) {
      setError(`Ошибка предпросмотра: ${error.message}`);
    } finally {
      setIsImportingSoundcloud(false);
    }
  };

  const handleImport = async () => {
    if (!fileContent) return;

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Создаем массив для новых плейлистов (будут добавлены в начало)
      const importedPlaylists = [];
      const createdPlaylistsCount = { success: 0, failed: 0 };
      const totalPlaylists = fileContent.length;

      for (let playlistIndex = 0; playlistIndex < fileContent.length; playlistIndex++) {
        const playlist = fileContent[playlistIndex];
        setImportProgress(Math.round((playlistIndex / totalPlaylists) * 100));

        try {
          // Валидация и форматирование имени плейлиста
          const newName = playlist.name?.trim() || `Импортированный плейлист (${new Date().toLocaleTimeString()})`;

          // Пропускаем пустые или невалидные плейлисты
          if (!playlist.tracks || !Array.isArray(playlist.tracks)) {
            const emptyPlaylist = {
              id: Date.now() + playlistIndex,
              name: newName,
              tracks: []
            };
            importedPlaylists.push(emptyPlaylist);
            createdPlaylistsCount.success++;
            continue;
          }

          // Фильтруем и подготавливаем валидные треки
          const validTracks = playlist.tracks
            .filter(track => track && track.id && track.platform && track.title)
            .map(track => ({
              id: track.id,
              platform: track.platform,
              title: track.title,
              uploader: track.uploader || 'Неизвестный исполнитель',
              thumbnail: track.thumbnail || '',
              duration: track.duration || 0
            }));

          if (validTracks.length === 0) {
            // Создаем пустой плейлист, если нет валидных треков
            const emptyPlaylist = {
              id: Date.now() + playlistIndex,
              name: newName,
              tracks: []
            };
            importedPlaylists.push(emptyPlaylist);
            createdPlaylistsCount.success++;
          } else {
            // Создаем новый плейлист сразу со всеми треками
            const newPlaylist = {
              id: Date.now() + playlistIndex,
              name: newName,
              tracks: validTracks
            };
            importedPlaylists.push(newPlaylist);
            createdPlaylistsCount.success++;
          }
        } catch (error) {
          console.error('Ошибка при импорте плейлиста:', error);
          createdPlaylistsCount.failed++;
        }
      }

      // Обновляем состояние (добавляем импортированные плейлисты в начало)
      const finalPlaylists = [...importedPlaylists, ...playlists];
      setPlaylists(finalPlaylists);

      // Принудительно сохраняем обновленные плейлисты на сервере
      await savePlaylistsToServer(finalPlaylists, likedTracks);

      // Сохраняем в localStorage для страховки
      localStorage.setItem('playlists', JSON.stringify(finalPlaylists));

      console.log(`Импорт завершен. Успешно: ${createdPlaylistsCount.success}, с ошибками: ${createdPlaylistsCount.failed}`);

      setImportProgress(100);

      // Небольшая задержка, чтобы показать 100% прогресс
      setTimeout(() => {
        setFileContent(null);
        setFileName('');
        setError('');
        setIsImporting(false);
        setImportProgress(0);
        onClose();
      }, 500);
    } catch (error) {
      console.error('Критическая ошибка при импорте плейлистов:', error);
      setError('Произошла ошибка при импорте. Плейлисты могли быть импортированы не полностью.');
      setIsImporting(false);
    }
  };

  const handleSoundcloudImport = async () => {
    if (!scPlaylistPreview) {
      await previewSoundcloudPlaylist();
      return;
    }

    setIsImportingSoundcloud(true);
    setError('');

    try {
      // Создаем новый плейлист в приложении
      const newPlaylist = {
        id: Date.now(),
        name: scPlaylistPreview.name,
        tracks: scPlaylistPreview.tracks
      };

      // Добавляем плейлист в локальное состояние
      const updatedPlaylists = [newPlaylist, ...playlists];
      setPlaylists(updatedPlaylists);

      // Сохраняем обновленные плейлисты на сервере
      await savePlaylistsToServer(updatedPlaylists, likedTracks);

      // Закрываем модальное окно
      onClose();
    } catch (error) {
      setError(`Ошибка импорта: ${error.message}`);
    } finally {
      setIsImportingSoundcloud(false);
    }
  };

  const selectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content import-modal">
        <h3 className="modal-title">Импорт плейлистов</h3>

        <div className="import-source-selector">
          <div
            className={`import-source-option ${importSource === 'file' ? 'active' : ''}`}
            onClick={() => {
              setImportSource('file');
              setScPlaylistPreview(null);
            }}
          >
            <span className="source-icon">📁</span>
            <span>Импорт из файла</span>
          </div>
          <div
            className={`import-source-option ${importSource === 'soundcloud' ? 'active' : ''}`}
            onClick={() => {
              setImportSource('soundcloud');
              setFileContent(null);
              setFileName('');
            }}
          >
            <span className="source-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.56 8.87V17h1.07v-8.13c0-2.2-2.39-2.43-2.39-2.43v3.11c1.32 0 1.32 1.32 1.32 1.32z" />
                <path d="M7.01 11.98v4.78h1.06v-4.78c0-1.32 1.32-1.32 1.32-1.32v-1.33c-2.38.01-2.38 2.65-2.38 2.65z" />
                <path d="M8.69 17h1.05v-6.53c0-1.32-1.21-1.32-1.32-1.32v1.32c.11 0 .27.11.27.27V17z" />
                <path d="M14.36 17h1.06v-5.95h1.32v-1.33h-1.32v-1.2c0-.12.07-.2.2-.2h1.12V7H15.2c-.74 0-1.32.59-1.32 1.32v2.4h.8v6.28z" />
              </svg>
            </span>
            <span>Импорт с SoundCloud</span>
          </div>
        </div>

        {error && (
          <div className="import-error-message">
            {error}
          </div>
        )}

        {importSource === 'file' ? (
          // Интерфейс импорта из файла
          !isImporting ? (
            <>
              <div className="file-import-container">
                <div
                  className="file-select-button"
                  onClick={selectFile}
                >
                  <span className="file-button-icon">📂</span>
                  <span className="file-button-text">Выбрать файл плейлистов</span>
                </div>

                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                />

                {fileName && (
                  <div className="selected-file-info">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{fileName}</span>
                  </div>
                )}

                {fileContent && (
                  <div className="file-preview">
                    <h4 className="preview-title">Плейлисты для импорта:</h4>
                    <div className="playlist-preview-list">
                      {fileContent.map((playlist, index) => (
                        <div key={index} className="playlist-preview-item">
                          <div className="preview-playlist-icon">🎵</div>
                          <div className="preview-playlist-info">
                            <div className="preview-playlist-name">{playlist.name}</div>
                            <div className="preview-track-count">
                              {playlist.tracks?.length || 0} {getTrackCountText(playlist.tracks?.length || 0)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            // Индикатор прогресса импорта из файла
            <div className="import-progress-container">
              <div className="progress-info">
                <div className="progress-label">Импорт плейлистов...</div>
                <div className="progress-percentage">{importProgress}%</div>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${importProgress}%` }}></div>
              </div>
              <p className="progress-note">Пожалуйста, не закрывайте это окно до завершения импорта</p>
            </div>
          )
        ) : (
          // Интерфейс импорта с SoundCloud
          <div className="soundcloud-import-container">
            {!scPlaylistPreview ? (
              // Форма для ввода URL плейлиста
              <>
                <div className="soundcloud-input-section">
                  <div className="input-label">Введите URL плейлиста SoundCloud</div>
                  <div className="soundcloud-url-input">
                    <input
                      type="text"
                      placeholder="https://soundcloud.com/username/sets/playlist-name"
                      value={soundcloudPlaylistUrl}
                      onChange={(e) => setSoundcloudPlaylistUrl(e.target.value)}
                      disabled={isImportingSoundcloud}
                    />
                    <button
                      className={`preview-soundcloud-button ${isImportingSoundcloud ? 'loading' : ''}`}
                      onClick={previewSoundcloudPlaylist}
                      disabled={isImportingSoundcloud || !soundcloudPlaylistUrl}
                    >
                      {isImportingSoundcloud ? 'Загрузка...' : 'Просмотр'}
                    </button>
                  </div>
                  <div className="soundcloud-example">
                    Пример: https://soundcloud.com/artistname/sets/playlist-title
                  </div>
                </div>
              </>
            ) : (
              // Предпросмотр плейлиста SoundCloud с добавленным отступом
              <div className="soundcloud-preview">
                <div className="preview-header">
                  <h4 className="preview-title">{scPlaylistPreview.name}</h4>
                  <div className="preview-track-count">
                    {scPlaylistPreview.tracks.length} {getTrackCountText(scPlaylistPreview.tracks.length)}
                  </div>
                  <button
                    className="back-to-input"
                    onClick={() => {
                      setScPlaylistPreview(null);
                      setError('');
                    }}
                  >
                    ← Изменить URL
                  </button>
                </div>

                <div className="preview-tracks-list">
                  {scPlaylistPreview.tracks.slice(0, 5).map((track, index) => (
                    <div key={index} className="preview-track-item">
                      <div className="preview-track-image">
                        {track.thumbnail ? (
                          <img src={track.thumbnail} alt={track.title} />
                        ) : (
                          <div className="track-image-placeholder">🎵</div>
                        )}
                      </div>
                      <div className="preview-track-info">
                        <div className="preview-track-title">{track.title}</div>
                        <div className="preview-track-artist">{track.uploader}</div>
                      </div>
                    </div>
                  ))}

                  {scPlaylistPreview.tracks.length > 5 && (
                    <div className="more-tracks-indicator">
                      +еще {scPlaylistPreview.tracks.length - 5} {getTrackCountText(scPlaylistPreview.tracks.length - 5)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isImportingSoundcloud && !scPlaylistPreview && (
              <div className="import-progress-container sc-loading">
                <div className="loading-spinner"></div>
                <p>Загрузка плейлиста...</p>
              </div>
            )}
          </div>

        )}

        <div className="modal-buttons">
          <div
            className="modal-button modal-button-cancel"
            onClick={onClose}
            style={{ opacity: (isImporting || isImportingSoundcloud) ? 0.5 : 1 }}
            disabled={isImporting || isImportingSoundcloud}
          >
            Отмена
          </div>
          <div
            className="modal-button modal-button-confirm"
            onClick={importSource === 'file' ? handleImport : handleSoundcloudImport}
            style={{
              opacity: ((importSource === 'file' && fileContent && !isImporting) ||
                (importSource === 'soundcloud' && (soundcloudPlaylistUrl || scPlaylistPreview) && !isImportingSoundcloud)) ? 1 : 0.5,
              cursor: ((importSource === 'file' && fileContent && !isImporting) ||
                (importSource === 'soundcloud' && (soundcloudPlaylistUrl || scPlaylistPreview) && !isImportingSoundcloud)) ? 'pointer' : 'not-allowed'
            }}
            disabled={(importSource === 'file' && (!fileContent || isImporting)) ||
              (importSource === 'soundcloud' && ((!soundcloudPlaylistUrl && !scPlaylistPreview) || isImportingSoundcloud))}
          >
            {isImporting || isImportingSoundcloud ? 'Импортирую...' :
              (importSource === 'soundcloud' && !scPlaylistPreview) ? 'Предпросмотр' : 'Импортировать'}
          </div>
        </div>
      </div>
    </div>
  );
};

// Компонент для просмотра треков в плейлисте или избранном
const TracksView = ({
  title,
  tracks,
  onBack,
  onPlayTrack,
  onRemoveTrack,
  onAddTrackToPlaylist,
  currentTrack,
  isPlaying,
  isLiked = false,
  toggleLike = null,
  playNext, // Новый проп
  addToQueue, // Новый проп
  shuffleMode, // Новый проп для состояния перемешивания
  toggleShuffleMode, // Новый проп для переключения перемешивания
  trackViewType = 'default' // Новый проп для вида отображения треков
}) => {
  // Добавляем состояние для поиска
  const [searchQuery, setSearchQuery] = useState('');
  
  // Добавляем состояние для сортировки треков с загрузкой из localStorage
  const [sortBy, setSortBy] = useState(() => {
    const saved = localStorage.getItem('tracksSortBy');
    return saved || 'newest'; // 'newest', 'alphabetical'
  });

  // Сохраняем предпочтения сортировки при изменении
  useEffect(() => {
    localStorage.setItem('tracksSortBy', sortBy);
  }, [sortBy]);

  // Состояние для контекстного меню
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    track: null
  });

  // Функция для сортировки треков
  const sortTracks = (tracksToSort) => {
    const tracksCopy = [...tracksToSort];
    
    switch (sortBy) {
      case 'newest':
        // Сортируем по новизне - самые новые сверху
        // Треки уже добавляются в начало массива, поэтому просто возвращаем как есть
        return tracksCopy;
        
      case 'alphabetical':
        // Сортируем по алфавиту (по названию трека)
        return tracksCopy.sort((a, b) => {
          const titleA = (a.title || '').toLowerCase();
          const titleB = (b.title || '').toLowerCase();
          return titleA.localeCompare(titleB, 'ru');
        });
        
      default:
        return tracksCopy;
    }
  };

  // Функция для фильтрации и сортировки треков
  const processedTracks = (() => {
    // Сначала фильтруем
    const filtered = tracks.filter(track => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      const title = (track.title || '').toLowerCase();
      const uploader = (track.uploader || '').toLowerCase();

      return title.includes(query) || uploader.includes(query);
    });
    
    // Затем сортируем
    return sortTracks(filtered);
  })();

  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  // Обработчик контекстного меню трека
  const handleContextMenu = (e, track) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      track
    });
  };

  // Обработчик для кнопки управления очередью
  // Обновленный обработчик для кнопки управления очередью
  const handleQueueButtonClick = (e, track) => {
    e.preventDefault();
    e.stopPropagation();

    // Фиксируем DOM-элемент, который будет использоваться как опорная точка
    const clickedButton = e.currentTarget;

    // Используем обычный объект вместо useRef для хранения ссылки
    setContextMenu({
      isOpen: true,
      buttonRef: { current: clickedButton },
      track
    });
  };

  // Закрытие контекстного меню
  const closeContextMenu = () => {
    setContextMenu({
      ...contextMenu,
      isOpen: false
    });
  };

  // Закрытие контекстного меню при клике вне
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.isOpen) {
        closeContextMenu();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.isOpen]);

  return (
    <div className="playlist-view">
      <div className="back-button-container">
        <div className="back-button" onClick={onBack}>
          <span className="back-button-icon">←</span> Назад к списку плейлистов
        </div>

        {/* Добавляем кнопку включения/выключения режима перемешивания */}
        <div className={`shuffle-button ${shuffleMode ? 'active' : ''}`} onClick={toggleShuffleMode} title={shuffleMode ? "Отключить перемешивание" : "Включить перемешивание"}>
          <div className="shuffle-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm0.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
            </svg>
          </div>
          <span className="shuffle-text">{shuffleMode ? "Перемешивание включено" : "Перемешивание"}</span>
        </div>
      </div>

      <h2 className="playlist-view-title">{title}</h2>

      {/* Добавляем поисковую строку и сортировку */}
      <div className="tracks-controls">
        <div className="playlist-search-container">
          <input
            type="text"
            className="playlist-search-input"
            placeholder="Поиск по названию или исполнителю"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="clear-search-button"
              onClick={() => setSearchQuery('')}
              title="Очистить поиск"
            >
              ✕
            </button>
          )}
        </div>

        <div className="sort-controls">
          <span className="sort-label">Сортировка:</span>
          <div className="sort-buttons">
            <button
              className={`sort-button ${sortBy === 'newest' ? 'active' : ''}`}
              onClick={() => setSortBy('newest')}
              title="Сортировать по новизне (новые сверху)"
            >
              <span className="sort-icon clock-icon"></span>
              <span className="sort-text">По новизне</span>
            </button>
            <button
              className={`sort-button ${sortBy === 'alphabetical' ? 'active' : ''}`}
              onClick={() => setSortBy('alphabetical')}
              title="Сортировать по алфавиту"
            >
              <span className="sort-icon alpha-icon"></span>
              <span className="sort-text">По алфавиту</span>
            </button>
          </div>
        </div>
      </div>

      {processedTracks.length > 0 ? (
        <div className={`playlist-tracks-list ${trackViewType === 'compact' ? 'compact' : ''}`}>
          {processedTracks.map(track => {
            const isCurrentTrack = currentTrack &&
              currentTrack.id === track.id &&
              currentTrack.platform === track.platform;
            const isTrackPlaying = isCurrentTrack && isPlaying;

            return (
              <div
                key={`${track.platform}-${track.id}`}
                className={`playlist-track-item ${trackViewType === 'compact' ? 'compact' : ''} ${isCurrentTrack ? 'active' : ''}`}
                onClick={() => onPlayTrack(track)}
                onContextMenu={(e) => handleContextMenu(e, track)}
              >
                <div className={`playlist-track-image ${trackViewType === 'compact' ? 'compact' : ''}`}>
                  {track.thumbnail && <img src={track.thumbnail} alt={track.title} />}
                </div>
                <div className="playlist-track-info">
                  <div className="playlist-track-title">{track.title}</div>
                  <div className="playlist-track-author">{track.uploader}</div>
                </div>
                <div className="playlist-track-actions" onClick={stopPropagation}>
                  <div
                    className={`playlist-track-action play-button ${isTrackPlaying ? 'active' : ''}`}
                    onClick={() => onPlayTrack(track)}
                    title={isTrackPlaying ? "Пауза" : "Воспроизвести"}
                  >
                    <div className="playlist-track-action-icon">
                      {isTrackPlaying ? '⏸' : '▶'}
                    </div>
                  </div>
                  <div
                    className="playlist-track-action add-button"
                    onClick={() => onAddTrackToPlaylist(track)}
                    title="Добавить в плейлист"
                  >
                    <div className="playlist-track-action-icon">+</div>
                  </div>
                  <div
                    className="playlist-track-action queue-button"
                    onClick={(e) => handleQueueButtonClick(e, track)}
                    title="Управление очередью"
                  >
                    <div className="playlist-track-action-icon">⋮</div>
                  </div>
                  {isLiked ? (
                    <div
                      className="playlist-track-action remove-button"
                      onClick={() => toggleLike(track)}
                      title="Удалить из любимых"
                    >
                      <div className="playlist-track-action-icon">✕</div>
                    </div>
                  ) : (
                    <div
                      className="playlist-track-action remove-button"
                      onClick={() => onRemoveTrack(track.id, track.platform)}
                      title="Удалить из плейлиста"
                    >
                      <div className="playlist-track-action-icon">✕</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="playlist-empty">
          {searchQuery ? (
            <p>По запросу "{searchQuery}" ничего не найдено.</p>
          ) : (
            <p>Здесь пока нет треков. {isLiked ? 'Добавьте треки в избранное с помощью кнопки в плеере.' : 'Добавьте треки через кнопку плеера или поиск.'}</p>
          )}
        </div>
      )}

      {/* Контекстное меню для трека */}
      <TrackContextMenu
        isOpen={contextMenu.isOpen}
        buttonRef={contextMenu.buttonRef}
        track={contextMenu.track}
        onClose={closeContextMenu}
        onPlayNext={playNext}
        onAddToQueue={addToQueue}
      />
    </div>
  );
};

// Компонент карточки "Любимое"
const FavoritesCard = ({ count, onClick, tracks = [], previewEnabled = false }) => {
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [fadeClass, setFadeClass] = useState('');
  
  // Выбираем случайные треки для предпросмотра
  const previewTracks = React.useMemo(() => {
    if (!previewEnabled || tracks.length === 0) return [];
    
    // Создаем копию массива и перемешиваем его
    const shuffled = [...tracks].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(3, shuffled.length));
  }, [tracks, previewEnabled]);

  // Анимация смены треков каждые 4 секунды
  useEffect(() => {
    if (!previewEnabled || previewTracks.length <= 1) return;
    
    const interval = setInterval(() => {
      setFadeClass('fade-out');
      
      setTimeout(() => {
        setCurrentPreviewIndex(prev => (prev + 1) % previewTracks.length);
        setFadeClass('fade-in');
        
        setTimeout(() => {
          setFadeClass('');
        }, 300);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, [previewEnabled, previewTracks.length]);

  const currentTrack = previewTracks[currentPreviewIndex];
  const showPreview = previewEnabled && currentTrack;

  return (
    <div className="favorites-card" onClick={onClick}>
      <div className="favorites-icon">❤</div>
      <div className="favorites-info">
        <div className="favorites-title">Любимое</div>
        <div className="favorites-count">{count} {getTrackCountText(count)}</div>
      </div>
      
      {showPreview && (
        <div className={`favorites-preview ${fadeClass}`}>
          <div className="preview-track-image">
            {currentTrack.thumbnail ? (
              <img src={currentTrack.thumbnail} alt={currentTrack.title} />
            ) : (
              <div className="preview-track-placeholder">🎵</div>
            )}
          </div>
          <div className="preview-track-info">
            <div className="preview-track-title">{currentTrack.title}</div>
            <div className="preview-track-artist">{currentTrack.uploader}</div>
          </div>
        </div>
      )}
    </div>
  );
};

// Компонент кнопки создания плейлиста
const CreatePlaylistButton = ({ onClick }) => {
  return (
    <div className="create-playlist-button" onClick={onClick}>
      <div className="plus-icon">+</div>
      <span className="create-playlist-text">Создать плейлист</span>
    </div>
  );
};

// Компактный компонент плейлиста
const PlaylistListItem = ({ playlist, onClick, onDelete, onEdit, index, onDragStart, onDragEnd, onDragOver, onDrop }) => {
  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      className="playlist-list-item"
      onClick={() => onClick(playlist)}
      draggable="true"
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      data-index={index}
    >
      <div className="playlist-list-cover">
        {playlist.tracks.length > 0 && playlist.tracks[0].thumbnail ? (
          <img src={playlist.tracks[0].thumbnail} alt={playlist.name} />
        ) : (
          <div className="playlist-list-icon">♪</div>
        )}
      </div>
      <div className="playlist-list-info">
        <div className="playlist-list-name">{playlist.name}</div>
        <div className="playlist-list-count">{playlist.tracks.length} {getTrackCountText(playlist.tracks.length)}</div>
      </div>
      <div className="playlist-list-actions">
        <div
          className="playlist-list-edit-button"
          onClick={(e) => {
            stopPropagation(e);
            onEdit(playlist);
          }}
          title="Редактировать плейлист"
        >
          ✎
        </div>
        <div
          className="playlist-list-delete-button"
          onClick={(e) => {
            stopPropagation(e);
            onDelete(playlist);
          }}
          title="Удалить плейлист"
        >
          ✕
        </div>
      </div>
    </div>
  );
};

// Компонент карточки плейлиста (обновленный)
const PlaylistCard = ({ playlist, onClick, onDelete, onEdit, index, onDragStart, onDragEnd, onDragOver, onDrop }) => {
  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  // Обновленная функция получения обложки плейлиста
  const getPlaylistCover = (tracks) => {
    // Если у плейлиста есть кастомная обложка, используем ее
    if (playlist.customCover) {
      return (
        <div className="playlist-cover">
          <img src={playlist.customCover} alt={playlist.name} className="playlist-cover-image custom" />
        </div>
      );
    }

    // Если треков нет, показываем иконку по умолчанию
    if (!tracks || tracks.length === 0) {
      return (
        <div className="playlist-cover empty">
          <div className="playlist-icon">♪</div>
        </div>
      );
    }

    // Получаем до 3 лучших обложек для коллажа
    let thumbnails = [];

    // Предпочитаем треки с обложками
    const tracksWithCovers = tracks.filter(track => track.thumbnail);
    const tracksToUse = tracksWithCovers.length > 0 ? tracksWithCovers : tracks;

    // Берем до 3 треков (предпочтительно с уникальными обложками)
    let uniqueUrls = new Set();
    let coverTracks = [];

    for (let track of tracksToUse) {
      if (!track.thumbnail) continue;
      if (!uniqueUrls.has(track.thumbnail)) {
        uniqueUrls.add(track.thumbnail);
        coverTracks.push(track);
        if (coverTracks.length >= 3) break;
      }
    }

    // Если уникальных меньше 3, добавляем любые доступные
    if (coverTracks.length < 3 && tracksToUse.length > 0) {
      for (let i = 0; coverTracks.length < 3 && i < tracksToUse.length; i++) {
        if (tracksToUse[i].thumbnail && !coverTracks.includes(tracksToUse[i])) {
          coverTracks.push(tracksToUse[i]);
        }
      }
    }

    // Если все равно недостаточно, дублируем существующие
    while (coverTracks.length < 3 && coverTracks.length > 0) {
      coverTracks.push(coverTracks[coverTracks.length % coverTracks.length]);
    }

    thumbnails = coverTracks.map(track => track.thumbnail);

    // Возвращаем новый компонент для коллажа
    return (
      <div className="playlist-cover collage">
        {thumbnails.length > 0 ? (
          <div className="cover-collage">
            {thumbnails.map((thumb, index) => (
              <div
                key={index}
                className={`collage-image collage-image-${index + 1}`}
                style={{ backgroundImage: `url(${thumb})` }}
              />
            ))}
            <div className="collage-overlay"></div>
          </div>
        ) : (
          <div className="playlist-icon">♪</div>
        )}
      </div>
    );
  };

  return (
    <div
      className="playlist-card"
      onClick={() => onClick(playlist)}
      draggable="true"
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      data-index={index}
    >
      <div className="playlist-image">
        {getPlaylistCover(playlist.tracks)}
      </div>
      <div className="playlist-info">
        <div className="playlist-name">{playlist.name}</div>
        <div className="track-count">{playlist.tracks.length} {getTrackCountText(playlist.tracks.length)}</div>
      </div>
      <div className="playlist-buttons">
        <div
          className="edit-playlist-button"
          onClick={(e) => {
            stopPropagation(e);
            onEdit(playlist);
          }}
          title="Редактировать плейлист"
        >
          ✎
        </div>
        <div
          className="delete-playlist-button"
          onClick={(e) => {
            stopPropagation(e);
            onDelete(playlist);
          }}
          title="Удалить плейлист"
        >
          ✕
        </div>
      </div>
    </div>
  );
};

// Основной компонент вкладки коллекции
const CollectionTab = ({
  onPlayTrack,
  likedTracks,
  playlists,
  viewingPlaylist,
  viewingFavorites,
  toggleLike,
  createPlaylist,
  deletePlaylist,
  viewPlaylist,
  exitPlaylistView,
  viewFavorites,
  exitFavoritesView,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  addTrackToPlaylists,
  reorderPlaylists,  // Новый проп для перестановки плейлистов
  currentTrack,
  isPlaying,
  savePlaylistsToServer,
  setPlaylists,
  playNext,          // Новый проп
  addToQueue,        // Новый проп
  shuffleMode,       // Новый проп
  toggleShuffleMode, // Новый проп
  // Настройки отображения
  playlistViewType = 'grid',
  trackViewType = 'default',
  favoritesPreviewEnabled = false
}) => {
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, playlist: null });
  const [createPlaylistModal, setCreatePlaylistModal] = useState(false);
  const [addToPlaylistModal, setAddToPlaylistModal] = useState({ isOpen: false, track: null });
  const [exportPlaylistsModal, setExportPlaylistsModal] = useState(false);
  const [combinePlaylistsModal, setCombinePlaylistsModal] = useState(false);
  const [importPlaylistsModal, setImportPlaylistsModal] = useState(false);
  const [editPlaylistModal, setEditPlaylistModal] = useState({ isOpen: false, playlist: null });
  const [draggedPlaylistIndex, setDraggedPlaylistIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState({ show: false, position: null });

  // Обработчики для перетаскивания
  const handleDragStart = (e, index) => {
    setDraggedPlaylistIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index);
    
    // Создаем простой невидимый drag image чтобы убрать растяжение
    const dragImage = document.createElement('div');
    dragImage.style.width = '1px';
    dragImage.style.height = '1px';
    dragImage.style.backgroundColor = 'transparent';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Убираем временный элемент и добавляем класс dragging
    requestAnimationFrame(() => {
      document.body.removeChild(dragImage);
      const element = document.querySelector(`.playlist-card[data-index="${index}"]`);
      if (element) {
        element.classList.add('dragging');
      }
    });
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    setDropIndicator({ show: false, position: null });
    setDraggedPlaylistIndex(null);
    
    // Убираем все drag классы
    const draggingElements = document.querySelectorAll('.playlist-card.dragging');
    draggingElements.forEach(el => el.classList.remove('dragging'));
    
    const dragOverElements = document.querySelectorAll('.playlist-card.drag-over');
    dragOverElements.forEach(el => el.classList.remove('drag-over'));
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedPlaylistIndex === null || draggedPlaylistIndex === index) {
      return;
    }

    // Убираем предыдущие drag-over классы
    const prevElements = document.querySelectorAll('.playlist-card.drag-over');
    prevElements.forEach(el => el.classList.remove('drag-over'));
    
    // Добавляем класс текущему элементу
    e.currentTarget.classList.add('drag-over');
    
    // Определение положения более стабильно
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const position = x < width / 2 ? 'left' : 'right';

    // Обновляем индикатор только при изменении позиции
    if (dropIndicator.index !== index || dropIndicator.position !== position) {
      setDropIndicator({
        show: true,
        position: position,
        index: index
      });
    }
  };

  const handleDragLeave = (e) => {
    // Проверяем, что мышь действительно покинула элемент
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('drag-over');
      // Не убираем индикатор сразу, только если мышь покинула всю область сетки
      if (!e.relatedTarget || !e.relatedTarget.closest('.playlists-grid')) {
        setDropIndicator({ show: false, position: null });
      }
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    console.log('Drop event:', { draggedPlaylistIndex, targetIndex, position: dropIndicator.position });
    
    if (draggedPlaylistIndex === null || draggedPlaylistIndex === targetIndex) {
      console.log('Drop cancelled: same or null index');
      handleDragEnd(e);
      return;
    }

    // Используем переданную функцию для обновления порядка
    reorderPlaylists(draggedPlaylistIndex, targetIndex, dropIndicator.position);

    handleDragEnd(e);
  };

  // Обработчик удаления плейлиста
  const handleDeletePlaylist = (playlist) => {
    setDeleteConfirmModal({ isOpen: true, playlist });
  };

  const confirmDeletePlaylist = () => {
    if (deleteConfirmModal.playlist) {
      deletePlaylist(deleteConfirmModal.playlist.id);
    }
    setDeleteConfirmModal({ isOpen: false, playlist: null });
  };

  const cancelDeletePlaylist = () => {
    setDeleteConfirmModal({ isOpen: false, playlist: null });
  };

  // Обработчик добавления трека в плейлист
  const handleAddToPlaylist = (track) => {
    setAddToPlaylistModal({ isOpen: true, track });
  };

  // Обработчик создания плейлиста из модального окна
  const handleCreatePlaylistFromModal = (name) => {
    createPlaylist(name);
  };

  // Обработчик редактирования плейлиста
  const handleEditPlaylist = (playlist) => {
    setEditPlaylistModal({ isOpen: true, playlist });
  };

  // Функция сохранения изменений плейлиста
  const savePlaylistChanges = (playlistId, changes) => {
    const updatedPlaylists = playlists.map(playlist => {
      if (playlist.id === playlistId) {
        return {
          ...playlist,
          name: changes.name,
          customCover: changes.customCover
        };
      }
      return playlist;
    });

    setPlaylists(updatedPlaylists);
    savePlaylistsToServer(updatedPlaylists, likedTracks);
  };

  // Обработчик удаления трека из плейлиста
  const handleRemoveFromPlaylist = (trackId, platform) => {
    if (viewingPlaylist) {
      removeTrackFromPlaylist(viewingPlaylist.id, trackId, platform);
    }
  };

  // Функция экспорта плейлистов
  const handleExportPlaylists = (playlistIds) => {
    const playlistsToExport = playlists
      .filter(playlist => playlistIds.includes(playlist.id))
      .map(({ name, tracks }) => {
        const formattedTracks = tracks.map(track => ({
          id: track.id,
          platform: track.platform,
          title: track.title,
          uploader: track.uploader || 'Неизвестный исполнитель',
          thumbnail: track.thumbnail || '',
          duration: track.duration || 0
        }));

        return {
          name,
          tracks: formattedTracks
        };
      });

    const dataStr = JSON.stringify(playlistsToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'music_playlists.json';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // Функция комбинирования плейлистов
  const handleCombinePlaylists = async (playlistIds, combinedName) => {
    try {
      const selectedPlaylists = playlists.filter(playlist => playlistIds.includes(playlist.id));
      
      // Собираем все треки из выбранных плейлистов
      const allTracks = [];
      const trackIds = new Set(); // Для избежания дубликатов по ID и платформе
      
      selectedPlaylists.forEach(playlist => {
        playlist.tracks.forEach(track => {
          const trackKey = `${track.platform}:${track.id}`;
          if (!trackIds.has(trackKey)) {
            trackIds.add(trackKey);
            allTracks.push({ ...track });
          }
        });
      });

      // Создаем новый плейлист
      const newPlaylist = {
        id: Date.now(),
        name: combinedName,
        tracks: allTracks
      };

      // Добавляем новый плейлист в список
      const updatedPlaylists = [newPlaylist, ...playlists];
      setPlaylists(updatedPlaylists);

      // Сохраняем на сервере
      await savePlaylistsToServer(updatedPlaylists, likedTracks);
      
      setCombinePlaylistsModal(false);
      
      // Показываем уведомление о успехе
      console.log(`Плейлист "${combinedName}" создан из ${selectedPlaylists.length} плейлистов с ${allTracks.length} треками`);
      
    } catch (error) {
      console.error('Error combining playlists:', error);
    }
  };

  // Отображение избранных треков
  if (viewingFavorites) {
    return (
      <div className="collection-tab-wrapper">
        <div className="collection-content-container">
          <TracksView
            title="Любимое"
            tracks={likedTracks}
            onBack={exitFavoritesView}
            onPlayTrack={onPlayTrack}
            onRemoveTrack={() => { }}
            onAddTrackToPlaylist={handleAddToPlaylist}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            isLiked={true}
            toggleLike={toggleLike}
            playNext={playNext}
            addToQueue={addToQueue}
            shuffleMode={shuffleMode}
            toggleShuffleMode={toggleShuffleMode}
            trackViewType={trackViewType}
          />
        </div>

        <AddToPlaylistModal
          isOpen={addToPlaylistModal.isOpen}
          track={addToPlaylistModal.track}
          playlists={playlists}
          onClose={() => setAddToPlaylistModal({ isOpen: false, track: null })}
          onAddToPlaylists={addTrackToPlaylists}
          onCreateNewPlaylist={(name, track) => createPlaylist(name, track)}
        />
      </div>
    );
  }

  // Отображение отдельного плейлиста
  if (viewingPlaylist) {
    return (
      <div className="collection-tab-wrapper">
        <div className="collection-content-container">
          <TracksView
            title={viewingPlaylist.name}
            tracks={viewingPlaylist.tracks}
            onBack={exitPlaylistView}
            onPlayTrack={onPlayTrack}
            onRemoveTrack={handleRemoveFromPlaylist}
            onAddTrackToPlaylist={handleAddToPlaylist}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            playNext={playNext}
            addToQueue={addToQueue}
            shuffleMode={shuffleMode}
            toggleShuffleMode={toggleShuffleMode}
            trackViewType={trackViewType}
          />
        </div>

        <AddToPlaylistModal
          isOpen={addToPlaylistModal.isOpen}
          track={addToPlaylistModal.track}
          playlists={playlists.filter(p => !viewingPlaylist || p.id !== viewingPlaylist.id)}
          onClose={() => setAddToPlaylistModal({ isOpen: false, track: null })}
          onAddToPlaylists={addTrackToPlaylists}
          onCreateNewPlaylist={(name, track) => createPlaylist(name, track)}
        />
      </div>
    );
  }

  // Основное отображение вкладки коллекции (плейлисты и любимое)
  return (
    <div className="collection-tab-wrapper">
      <div className="collection-content-container">
        <div className="favorites-container">
          <FavoritesCard
            count={likedTracks.length}
            onClick={viewFavorites}
            tracks={likedTracks}
            previewEnabled={favoritesPreviewEnabled}
          />
        </div>

        <div className="playlists-section">
          <div className="playlists-header">
            <h3 className="playlists-title">Плейлисты</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div
                className="create-playlist-button"
                onClick={() => setImportPlaylistsModal(true)}
                style={{ background: 'rgba(var(--accent-color-rgb, 181, 58, 212), 0.7)' }}
                title="Импорт плейлистов"
              >
                <div className="import-icon"></div>
                <span className="create-playlist-text">Импорт</span>
              </div>
              <div
                className="create-playlist-button"
                onClick={() => setExportPlaylistsModal(true)}
                style={{ background: 'rgba(var(--accent-color-rgb, 181, 58, 212), 0.7)' }}
                title="Экспорт плейлистов"
              >
                <div className="export-icon"></div>
                <span className="create-playlist-text">Экспорт</span>
              </div>
              <div
                className="create-playlist-button"
                onClick={() => setCombinePlaylistsModal(true)}
                style={{ background: 'rgba(var(--accent-color-rgb, 58, 181, 102), 0.7)' }}
                title="Комбинировать плейлисты"
              >
                <div className="combine-icon"></div>
                <span className="create-playlist-text">Комбинировать</span>
              </div>
              <CreatePlaylistButton onClick={() => setCreatePlaylistModal(true)} />
            </div>
          </div>

          <div className="playlists-grid-container">
            {playlists.length > 0 ? (
              <div
                className={`${playlistViewType === 'list' ? 'playlists-list' : 'playlists-grid'} ${isDragging ? 'dragging-active' : ''}`}
                onDragLeave={(e) => {
                  // Убираем drag-over классы при покидании всей сетки
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    const dragOverElements = document.querySelectorAll('.playlist-card.drag-over, .playlist-list-item.drag-over');
                    dragOverElements.forEach(el => el.classList.remove('drag-over'));
                    setDropIndicator({ show: false, position: null });
                  }
                }}
              >
                {playlists.map((playlist, index) => (
                  <React.Fragment key={playlist.id}>
                    {dropIndicator.show && dropIndicator.index === index && dropIndicator.position === 'left' && (
                      <div className="drop-indicator drop-indicator-left"></div>
                    )}
                    {playlistViewType === 'list' ? (
                      <PlaylistListItem
                        playlist={playlist}
                        onClick={viewPlaylist}
                        onDelete={handleDeletePlaylist}
                        onEdit={handleEditPlaylist}
                        index={index}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      />
                    ) : (
                      <PlaylistCard
                        playlist={playlist}
                        onClick={viewPlaylist}
                        onDelete={handleDeletePlaylist}
                        onEdit={handleEditPlaylist}
                        index={index}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      />
                    )}
                    {dropIndicator.show && dropIndicator.index === index && dropIndicator.position === 'right' && (
                      <div className="drop-indicator drop-indicator-right"></div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div className="playlists-empty">
                <p className="empty-text">
                  У вас пока нет плейлистов.<br />
                  Нажмите кнопку "Создать плейлист", чтобы создать свой первый плейлист!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        title="Удаление плейлиста"
        message={`Вы действительно хотите удалить плейлист "${deleteConfirmModal.playlist?.name}"?`}
        onConfirm={confirmDeletePlaylist}
        onCancel={cancelDeletePlaylist}
      />

      <CreatePlaylistModal
        isOpen={createPlaylistModal}
        onClose={() => setCreatePlaylistModal(false)}
        onConfirm={handleCreatePlaylistFromModal}
      />

      <EditPlaylistModal
        isOpen={editPlaylistModal.isOpen}
        playlist={editPlaylistModal.playlist}
        onClose={() => setEditPlaylistModal({ isOpen: false, playlist: null })}
        onSave={savePlaylistChanges}
      />

      <AddToPlaylistModal
        isOpen={addToPlaylistModal.isOpen}
        track={addToPlaylistModal.track}
        playlists={playlists}
        onClose={() => setAddToPlaylistModal({ isOpen: false, track: null })}
        onAddToPlaylists={addTrackToPlaylists}
        onCreateNewPlaylist={(name, track) => createPlaylist(name, track)}
      />

      <ExportPlaylistsModal
        isOpen={exportPlaylistsModal}
        playlists={playlists}
        onClose={() => setExportPlaylistsModal(false)}
        onExport={handleExportPlaylists}
      />

      <CombinePlaylistsModal
        isOpen={combinePlaylistsModal}
        playlists={playlists}
        onClose={() => setCombinePlaylistsModal(false)}
        onCombine={handleCombinePlaylists}
      />

      <ImportPlaylistsModal
        isOpen={importPlaylistsModal}
        playlists={playlists}
        likedTracks={likedTracks}
        onClose={() => setImportPlaylistsModal(false)}
        savePlaylistsToServer={savePlaylistsToServer}
        setPlaylists={setPlaylists}
      />
    </div>
  );
};

export default CollectionTab;