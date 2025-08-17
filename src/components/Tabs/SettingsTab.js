import React from 'react';
import SettingsPanel from './SettingsPanel';

const SettingsTab = ({
  visualizerType,
  setVisualizerType,
  visibleWidgets,
  toggleWidgetVisibility,
  clearGifsFromDB,
  dbInitialized,
  // Настройки коллекции
  playlistViewType,
  onPlaylistViewTypeChange,
  trackViewType,
  onTrackViewTypeChange,
  favoritesPreviewEnabled,
  onFavoritesPreviewToggle
}) => {
  return (
    <SettingsPanel
      visualizerType={visualizerType}
      setVisualizerType={setVisualizerType}
      visibleWidgets={visibleWidgets}
      toggleWidgetVisibility={toggleWidgetVisibility}
      clearGifsFromDB={clearGifsFromDB}
      dbInitialized={dbInitialized}
      hideCloseButton={true}
      playlistViewType={playlistViewType}
      onPlaylistViewTypeChange={onPlaylistViewTypeChange}
      trackViewType={trackViewType}
      onTrackViewTypeChange={onTrackViewTypeChange}
      favoritesPreviewEnabled={favoritesPreviewEnabled}
      onFavoritesPreviewToggle={onFavoritesPreviewToggle}
    />
  );
};

export default SettingsTab;