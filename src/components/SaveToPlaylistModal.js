import React, { useState } from 'react';
import './CollectionTab.css';

const SaveToPlaylistModal = ({ isOpen, track, playlists, onClose, onAddToPlaylists, onCreatePlaylist }) => {
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
            onCreatePlaylist(newPlaylistName, track);
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

export default SaveToPlaylistModal;