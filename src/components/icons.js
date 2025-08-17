import React from 'react';

export const PlayIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21" />
    </svg>
);

export const PauseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
    </svg>
);

export const NextIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,4 15,12 5,20" />
        <line x1="19" y1="5" x2="19" y2="19" strokeWidth="2" stroke="currentColor" />
    </svg>
);

export const PrevIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="19,20 9,12 19,4" />
        <line x1="5" y1="5" x2="5" y2="19" strokeWidth="2" stroke="currentColor" />
    </svg>
);

export const LikeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
);

export const RepeatIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <polyline points="17 1 21 5 17 9" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" stroke="currentColor" strokeWidth="2" fill="none" />
        <polyline points="7 23 3 19 7 15" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
);

export const ShuffleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <polyline points="16 3 21 3 21 8" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="4" y1="20" x2="21" y2="3" stroke="currentColor" strokeWidth="2" />
        <polyline points="21 16 21 21 16 21" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="15" y1="15" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
        <line x1="4" y1="4" x2="9" y2="9" stroke="currentColor" strokeWidth="2" />
    </svg>
);

export const PlaylistIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" />
        <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" />
        <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" />
        <line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" strokeWidth="2" />
        <line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" strokeWidth="2" />
        <line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" strokeWidth="2" />
    </svg>
);

export const QueueIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15 6v12l5-6z" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="4" y="4" width="6" height="16" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
);