// src/components/Component.js
import React from "react";
import "./Component.css";

const Component = ({
  className,
  track,
  onClick,
  isUnavailable,
  onLike,
  onAddToPlaylist,
  isLiked = false,
  showDuration = false,
  formattedDuration = ""
}) => {
  const handleLikeClick = (e) => {
    e.stopPropagation();
    if (onLike) onLike(track);
  };

  const handleAddToPlaylistClick = (e) => {
    e.stopPropagation();
    if (onAddToPlaylist) onAddToPlaylist(track);
  };

  const getPlatformIcon = () => {
    if (!track || !track.platform) return null;

    switch (track.platform) {
      case 'youtube':
        return (
          <div className="platform-icon youtube">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </div>
        );
      case 'soundcloud':
        return (
          <div className="platform-icon soundcloud">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027c-.302-.024-.526-.03-1 .122v5.689c.446.143.636.138 1 .138v-5.949z" />
            </svg>
          </div>
        );
      case 'yandex_music':
        return (
          <div className="platform-icon yandex-music">
            <svg viewBox="0 0 48 48" fill="currentColor">
              <path fill="#212121" d="M24.001,44.001c11.045,0,20-8.955,20-20s-8.955-20-20-20    c-11.045,0-20,8.955-20,20S12.956,44.001,24.001,44.001z"></path>
              <path fill="#fcbe2d" d="M39.2,20.019l-0.129-0.607l-5.097-0.892l2.968-4.021    L36.6,14.104l-4.364,2.104l0.552-5.573l-0.447-0.261l-2.655,4.52l-2.971-6.728h-0.524l0.709,6.491l-7.492-6.019l-0.631,0.184    l5.757,7.281l-11.407-3.812l-0.527,0.58L22.8,18.705L8.739,19.887l-0.157,0.868l14.612,1.601L10.999,32.504l0.527,0.708    l14.508-7.937l-2.864,13.984h0.868l5.569-13.168L33,36.392l0.603-0.473L32.212,25.46l5.28,6.019l0.341-0.555l-4.045-7.463    l5.649,2.103l0.053-0.631l-5.072-3.76L39.2,20.019z"></path>
            </svg>
          </div>
        );
      case 'vkmusic':
        return (
          <div className="platform-icon vkmusic">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4 8.113 4 7.676c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.847 2.472 2.27 4.642 2.856 4.642.22 0 .322-.102.322-.66V8.926c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.743c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.15-3.574 2.15-3.574.119-.254.373-.491.712-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.745-.576.745z" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`component ${className || ''} ${isUnavailable ? 'unavailable' : ''}`}
      onClick={onClick}
    >
      <div className="rectangle">
        {track && track.thumbnail && (
          <img
            src={track.thumbnail}
            alt={track.title}
          />
        )}

        <div className="overlay-play-button">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>

        {showDuration && track && track.duration && (
          <div className="track-duration">
            {formattedDuration ||
              `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`}
          </div>
        )}

        {getPlatformIcon()}
      </div>

      <div className="text-wrapper">
        {track ? track.title : 'CardTrackName'}
      </div>

      <div className="card-author">
        {track ? (track.uploader || track.artist) : 'Author'}
      </div>

      <div className="card-footer">
        <button
          className={`card-action like-button ${isLiked ? 'active' : ''}`}
          onClick={handleLikeClick}
          title="Добавить в избранное"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d={isLiked
              ? "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              : "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"}
            />
          </svg>
        </button>
        <button
          className="card-action playlist-button"
          onClick={handleAddToPlaylistClick}
          title="Добавить в плейлист"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Component;