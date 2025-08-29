import { getNotificationManager } from '../components/NotificationSystem';

export const API_BASE_URL = 'http://127.0.0.1:5000/api';

const activeRequests = {};
let cancelRequested = false;

const getNotifications = () => {
  const manager = getNotificationManager();
  return manager || {
    handleApiError: () => { },
    showError: () => { },
    showWarning: () => { },
    showInfo: () => { },
    showSuccess: () => { }
  };
};

export const cancelPreloadOperations = () => {
  cancelRequested = true;

  Object.keys(activeRequests).forEach(key => {
    if (activeRequests[key] && activeRequests[key].abort) {
      activeRequests[key].abort();
    }
    delete activeRequests[key];
  });

  setTimeout(() => {
    cancelRequested = false;
  }, 100);
};

const youtubeUrlCache = {};

export const searchAllPlatforms = async (query) => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Поиск', 'Ищем треки...');
    const response = await fetch(`${API_BASE_URL}/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error(`Search error: ${response.status}`);
    }
    const data = await response.json();

    const totalResults = (data.youtube?.length || 0) + (data.soundcloud?.length || 0) + (data.yandex_music?.length || 0) + (data.vkmusic?.length || 0);

    if (totalResults === 0) {
      notifications.showWarning('Поиск завершен', 'По вашему запросу ничего не найдено', `Запрос: "${query}"`);
    } else {
      notifications.showSuccess('Поиск завершен', `Найдено ${totalResults} треков`, `YouTube: ${data.youtube?.length || 0}, SoundCloud: ${data.soundcloud?.length || 0}, Яндекс.Музыка: ${data.yandex_music?.length || 0}`);
    }

    return data;
  } catch (error) {
    console.error('Search error:', error);
    notifications.handleApiError(error, 'Search');
    return { youtube: [], soundcloud: [], yandex_music: [], vkmusic: [] };
  }
};

export const getLyrics = async (title, artist) => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Поиск текста', 'Ищем текст песни...');
    const response = await fetch(
      `${API_BASE_URL}/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        notifications.showSuccess('Текст найден', `Текст для "${title}" загружен`);
      }
      return data;
    } else if (response.status === 404) {
      const data = await response.json();
      notifications.showWarning('Текст не найден', `Текст для "${title}" не найден`);
      return data;
    } else {
      throw new Error(`Lyrics error: ${response.status}`);
    }
  } catch (error) {
    console.error('Error getting lyrics:', error);
    notifications.showError('Ошибка получения текста', `Не удалось получить текст для "${title}"`);
    return { success: false, error: error.message };
  }
};

export const getStreamUrl = (track) => {
  if (!track || !track.platform) return '';

  switch (track.platform) {
    case 'youtube':
      return `${API_BASE_URL}/fast-stream/youtube?id=${track.id}`;
    case 'soundcloud':
      return `${API_BASE_URL}/stream/soundcloud?id=${track.id}`;
    case 'yandex_music':
      return `${API_BASE_URL}/yandex-music/stream?id=${track.id}`;
    case 'vkmusic':
      return `${API_BASE_URL}/stream/vkmusic?id=${track.id}`;
    case 'local':
      return `${API_BASE_URL}/stream/local?id=${track.id}`;
    default:
      return '';
  }
};

export const getDirectStreamUrl = (track) => {
  return getStreamUrl(track);
};

export const getDownloadUrl = (track) => {
  if (!track || !track.platform) return '';

  switch (track.platform) {
    case 'youtube':
      return `${API_BASE_URL}/download/youtube?id=${encodeURIComponent(track.id)}`;
    case 'soundcloud':
      return `${API_BASE_URL}/download/soundcloud?id=${encodeURIComponent(track.id)}`;
    case 'yandex_music':
      return `${API_BASE_URL}/yandex-music/download?id=${encodeURIComponent(track.id)}`;
    case 'local':
      return `${API_BASE_URL}/download/local?id=${encodeURIComponent(track.id)}`;
    case 'vkmusic':
      return `${API_BASE_URL}/download/vkmusic?id=${encodeURIComponent(track.id)}`;
    default:
      return '';
  }
};

export const getFastStreamUrl = async (trackId) => {
  const streamUrl = `${API_BASE_URL}/fast-stream/youtube?id=${trackId}`;
  console.log(`[URL] Using proxy stream URL for ${trackId}`);
  return streamUrl;
};

export const checkSoundCloudTrackAvailability = async (trackId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/stream/soundcloud?id=${trackId}&direct=true`);

    if (response.ok) {
      const data = await response.json();
      return {
        available: true,
        url: data.url
      };
    } else {
      const errorData = await response.json();
      return {
        available: false,
        error: errorData.user_message || errorData.error || 'Трек недоступен',
        statusCode: response.status,
        platform: 'soundcloud'
      };
    }
  } catch (error) {
    return {
      available: false,
      error: 'Ошибка сети при проверке трека',
      platform: 'soundcloud'
    };
  }
};

export const batchPrefetchUrls = async (tracks, currentIndex = 0, count = 2) => {
  if (cancelRequested || !tracks || tracks.length === 0) return;

  const youtubeIds = tracks
    .filter(t => t.platform === 'youtube')
    .slice(currentIndex, currentIndex + count)
    .map(t => t.id);

  if (youtubeIds.length === 0) return;

  console.log(`[Prefetch] Prefetching URLs for ${youtubeIds.length} tracks starting from index ${currentIndex}`);

  try {
    const requestId = `batch_prefetch_${Date.now()}`;
    const controller = new AbortController();
    activeRequests[requestId] = controller;

    const response = await fetch(`${API_BASE_URL}/youtube/preload-tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        track_ids: youtubeIds,
        context: 'batch_prefetch'
      }),
      signal: controller.signal
    });

    delete activeRequests[requestId];

    if (!response.ok) {
      console.warn('[Prefetch] URL prefetch error:', response.status);
    } else {
      console.log('[Prefetch] URL prefetch started successfully');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('[Prefetch] Request canceled');
    } else {
      console.error('[Prefetch] URL prefetch error:', error);
    }
  }
};

export const preloadAdjacentTracks = async (currentTrack, queue, queueIndex) => {
  if (!queue || queue.length === 0) return;

  const tracksToPreload = [];

  if (queueIndex === -1) {
    for (let i = 0; i < Math.min(2, queue.length); i++) {
      const track = queue[i];
      if (track && track.platform === 'youtube') {
        tracksToPreload.push(track);
      }
    }
  } else if (queueIndex >= 0) {
    if (queueIndex > 0) {
      const prevTrack = queue[queueIndex - 1];
      if (prevTrack && prevTrack.platform === 'youtube') {
        tracksToPreload.push(prevTrack);
      }
    }

    if (queueIndex < queue.length - 1) {
      const nextTrack = queue[queueIndex + 1];
      if (nextTrack && nextTrack.platform === 'youtube') {
        tracksToPreload.push(nextTrack);
      }
    }
  }

  if (tracksToPreload.length === 0) return;

  try {
    const trackIds = tracksToPreload.map(track => track.id);
    console.log(`[Preload] Starting preload for ${trackIds.length} tracks:`, trackIds);

    const response = await fetch(`${API_BASE_URL}/youtube/preload-tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        track_ids: trackIds,
        current_track_id: currentTrack?.id || null,
        context: queueIndex === -1 ? 'shuffle_start' : 'adjacent_tracks'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[Preload] Success:`, result);
    } else {
      console.warn(`[Preload] Server error:`, response.status);
    }
  } catch (error) {
    console.error('[Preload] Network error:', error);
  }
};

export const loadPlaylistsFromServer = async () => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Загрузка', 'Загружаем ваши данные...');
    const response = await fetch(`${API_BASE_URL}/playlists`);
    if (!response.ok) {
      throw new Error(`Error loading playlists: ${response.status}`);
    }
    const data = await response.json();
    notifications.showSuccess('Загрузка завершена', 'Данные успешно загружены', `Плейлистов: ${data.playlists?.length || 0}, Избранных: ${data.liked_tracks?.length || 0}`);
    return data;
  } catch (error) {
    console.error('Error loading playlists:', error);
    notifications.showWarning('Загрузка из кэша', 'Данные загружены из локального хранилища', 'Соединение с сервером недоступно');
    throw error;
  }
};

export const importSoundCloudPlaylist = async (playlistUrl) => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Импорт плейлиста', 'Начинаем импорт из SoundCloud...');
    const response = await fetch(`${API_BASE_URL}/soundcloud/import-playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: playlistUrl })
    });

    if (!response.ok) {
      throw new Error(`Error importing playlist: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      notifications.showSuccess(
        'Импорт завершен',
        `Плейлист "${data.playlist.name}" импортирован`,
        `Добавлено треков: ${data.playlist.tracks.length}`
      );
    } else {
      notifications.showError('Ошибка импорта', data.error || 'Не удалось импортировать плейлист');
    }

    return data;
  } catch (error) {
    console.error('Error importing SoundCloud playlist:', error);
    notifications.handleApiError(error, 'SoundCloud Import');
    throw error;
  }
};

export const getSavedTracks = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/saved-tracks`);
    if (!response.ok) {
      throw new Error(`Error loading saved tracks: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading saved tracks:', error);
    const notifications = getNotifications();
    notifications.handleApiError(error, 'Load Saved Tracks');
    return { saved_tracks: [] };
  }
};

export const saveTrack = async (track) => {
  const notifications = getNotifications();

  try {
    const response = await fetch(`${API_BASE_URL}/saved-tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track })
    });

    if (!response.ok) {
      throw new Error(`Error saving track: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      notifications.showSuccess('Трек сохранен', track.title, `Исполнитель: ${track.uploader}`);
    }

    return data;
  } catch (error) {
    console.error('Error saving track:', error);
    notifications.showError('Ошибка сохранения', 'Не удалось сохранить трек', `Трек: ${track.title}`, error);
    return { success: false, error: error.message };
  }
};

export const deleteSavedTrack = async (track) => {
  const notifications = getNotifications();

  try {
    const response = await fetch(`${API_BASE_URL}/saved-tracks/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: track.id, platform: track.platform })
    });

    if (!response.ok) {
      throw new Error(`Error deleting track: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      notifications.showInfo('Трек удален', 'Трек удален из сохраненных');
    }

    return data;
  } catch (error) {
    console.error('Error deleting track:', error);
    notifications.showError('Ошибка удаления', 'Не удалось удалить сохраненный трек', `ID: ${track.id}`, error);
    return { success: false, error: error.message };
  }
};

export const isTrackSaved = async (track) => {
  try {
    const response = await fetch(`${API_BASE_URL}/saved-tracks/check?id=${track.id}&platform=${track.platform}`);
    if (!response.ok) {
      throw new Error(`Error checking track: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error checking track:', error);
    return { is_saved: false };
  }
};

export const getCacheInfo = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cache/info`);
    if (!response.ok) {
      throw new Error(`Error getting cache info: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting cache info:', error);
    const notifications = getNotifications();
    notifications.handleApiError(error, 'Cache Info');
    return {
      total_urls: 0,
      expired_urls: 0,
      preloaded_urls: 0,
      used_urls: 0,
      fresh_urls: 0
    };
  }
};

export const clearCache = async () => {
  const notifications = getNotifications();

  try {
    const response = await fetch(`${API_BASE_URL}/cache/clear`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error(`Error clearing cache: ${response.status}`);
    }
    const data = await response.json();
    notifications.showSuccess('Кэш очищен', `Удалено записей: ${data.cleared_entries || 0}`);
    return data;
  } catch (error) {
    console.error('Error clearing cache:', error);
    notifications.handleApiError(error, 'Clear Cache');
    return { success: false, error: error.message };
  }
};

export const clearAllData = async () => {
  const notifications = getNotifications();

  try {
    notifications.showWarning('Очистка данных', 'Удаляем все данные приложения...');
    const response = await fetch(`${API_BASE_URL}/clear-all-data`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error(`Error clearing all data: ${response.status}`);
    }
    const data = await response.json();
    notifications.showSuccess(
      'Данные очищены',
      'Все данные приложения удалены',
      `Очищено файлов: ${data.removed_files?.length || 0}\nОчищено директорий: ${data.cleared_directories?.length || 0}\nКэш записей: ${data.cleared_url_cache || 0}`
    );
    return data;
  } catch (error) {
    console.error('Error clearing all data:', error);
    notifications.handleApiError(error, 'Clear All Data');
    return { success: false, error: error.message };
  }
};

export const getTracksFromLocalCache = () => {
  return [];
};

export const setCurrentTrack = async (track) => {
  if (!track || !track.id || !track.platform) {
    return { success: false, error: 'Invalid track data' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/set-current-track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track_id: track.id, platform: track.platform })
    });

    if (!response.ok) {
      throw new Error(`Error setting current track: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error setting current track:', error);
    return { success: false, error: error.message };
  }
};

export const updateQueueTracksOnServer = async (tracks) => {
  if (!tracks || !tracks.length) {
    return { success: false, message: 'Empty tracks list' };
  }

  try {
    const youtubeIds = tracks
      .filter(track => track.platform === 'youtube')
      .map(track => track.id);

    if (youtubeIds.length === 0) {
      return { success: true, message: 'No YouTube tracks to update' };
    }

    const response = await fetch(`${API_BASE_URL}/update-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks })
    });

    if (!response.ok) {
      throw new Error(`Error updating queue: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating queue:', error);
    return { success: false, error: error.message };
  }
};

export const checkTranscodeStatus = async (trackId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/youtube/url-status?id=${trackId}`);
    return await response.json();
  } catch (error) {
    console.error(`Error checking URL status for ${trackId}:`, error);
    return { status: 'error', error: error.message };
  }
};

export const waitForTranscoding = async (trackId) => {
  try {
    const url = await getFastStreamUrl(trackId);
    return url;
  } catch (error) {
    console.error(`Error getting URL for ${trackId}:`, error);
    return null;
  }
};

export const prepareYouTubeTrack = async (track) => {
  if (!track || !track.id) {
    throw new Error('Invalid track data');
  }

  try {
    const streamUrl = await getFastStreamUrl(track.id);
    return {
      ...track,
      streamUrl
    };
  } catch (error) {
    console.error(`Error preparing YouTube track ${track.id}:`, error);
    return {
      ...track,
      streamUrl: `${API_BASE_URL}/stream/youtube?id=${track.id}`
    };
  }
};

export const preloadQueueTracks = async (tracks, currentIndex) => {
  if (cancelRequested || !tracks || tracks.length === 0) {
    return;
  }

  batchPrefetchUrls(tracks, currentIndex, 5);
  return true;
};

export const getSoundCloudClientId = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/soundcloud/get-client-id`);
    if (!response.ok) {
      throw new Error(`Error getting Client ID: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting SoundCloud Client ID:', error);
    const notifications = getNotifications();
    notifications.handleApiError(error, 'SoundCloud Client ID');
    return { is_set: false };
  }
};

export const saveSoundCloudClientId = async (clientId) => {
  const notifications = getNotifications();

  try {
    const response = await fetch(`${API_BASE_URL}/soundcloud/save-client-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId })
    });

    if (!response.ok) {
      throw new Error(`Error saving Client ID: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      notifications.showSuccess('SoundCloud', 'Client ID сохранен');
    }

    return data;
  } catch (error) {
    console.error('Error saving SoundCloud Client ID:', error);
    notifications.handleApiError(error, 'Save SoundCloud Client ID');
    return { success: false, error: error.message };
  }
};

export const getSoundCloudTrackInfo = async (trackId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/soundcloud/get-track-info?id=${trackId}`);
    if (!response.ok) {
      throw new Error(`Error getting track info: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting SoundCloud track info:', error);
    return null;
  }
};

export const uploadMp3File = async (file, title, artist) => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Загрузка файла', `Загружаем "${title || file.name}"...`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || 'Unknown Title');
    formData.append('artist', artist || 'Unknown Artist');

    const response = await fetch(`${API_BASE_URL}/upload/mp3`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Error uploading file: ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      notifications.showSuccess(
        'Файл загружен',
        `Трек "${data.title}" добавлен`,
        `Исполнитель: ${data.artist}\nДлительность: ${Math.floor(data.duration / 60)}:${Math.floor(data.duration % 60).toString().padStart(2, '0')}`
      );
    }

    return data;
  } catch (error) {
    console.error('Error uploading MP3 file:', error);
    notifications.showError(
      'Ошибка загрузки',
      'Не удалось загрузить файл',
      `Файл: ${file.name}\nОшибка: ${error.message}`,
      error
    );
    return { success: false, error: error.message };
  }
};

export const downloadTrack = async (track) => {
  const notifications = getNotifications();

  if (!track || !track.platform || !track.id) {
    notifications.showError('Ошибка скачивания', 'Некорректные данные трека');
    throw new Error('Invalid track data');
  }

  if (track.platform === 'vkmusic') {
    notifications.showWarning('Скачивание недоступно', 'VK Music не поддерживается для скачивания');
    throw new Error('VK Music downloads not supported');
  }

  if (track.platform === 'local') {
    const link = document.createElement('a');
    link.href = getDownloadUrl(track);
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { success: true };
  }

  try {
    notifications.showInfo('Скачивание', `Подготавливаем "${track.title}" к скачиванию...`);

    const downloadUrl = getDownloadUrl(track);
    if (!downloadUrl) {
      throw new Error(`Download not supported for platform: ${track.platform}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 300000);

    try {
      const response = await fetch(downloadUrl, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 404) {
          notifications.showError(
            'Трек недоступен',
            `"${track.title}" не найден или недоступен для скачивания`,
            'Трек может быть удален или заблокирован'
          );
        } else if (response.status === 403) {
          notifications.showError(
            'Доступ запрещен',
            `"${track.title}" недоступен для скачивания`,
            'Возможно, требуется авторизация или трек заблокирован'
          );
        } else {
          notifications.showError(
            'Ошибка сервера',
            `Не удалось подготовить "${track.title}" к скачиванию`,
            `Код ошибки: ${response.status}`
          );
        }
        throw new Error(`Server error: ${response.status}`);
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = '';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const formatInfo = track.platform === 'youtube' ? 'M4A (высокое качество)' : 
                       track.platform === 'soundcloud' ? 'MP3' : 'Audio';

      notifications.showSuccess(
        'Скачивание начато',
        `"${track.title}" начал скачиваться`,
        `Формат: ${formatInfo}\nИсполнитель: ${track.uploader}`
      );

      return { success: true };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      notifications.showError(
        'Таймаут скачивания',
        `Скачивание "${track.title}" прервано по таймауту`,
        'Попробуйте скачать трек позже'
      );
    } else {
      const errorMessage = error.message.includes('Server error') ? 
        'Ошибка на стороне сервера' : 
        'Не удалось скачать трек';

      if (!error.message.includes('Server error')) {
        notifications.showError(
          'Ошибка скачивания',
          errorMessage,
          `Трек: ${track.title}\nПлатформа: ${track.platform}\nОшибка: ${error.message}`
        );
      }
    }
    throw error;
  }
};

export const handlePlaybackError = (track, error) => {
  const notifications = getNotifications();

  if (track?.platform === 'soundcloud') {
    if (error && (error.status === 404 || error.statusCode === 404)) {
      const message = error.user_message || error.error || 'Трек недоступен для воспроизведения';

      notifications.showWarning(
        'SoundCloud: Трек недоступен',
        `"${track.title}" не может быть воспроизведен`,
        message
      );
    } else if (error && (error.status === 500 || error.statusCode === 500)) {
      notifications.showError(
        'Ошибка SoundCloud',
        `Не удалось воспроизвести "${track.title}"`,
        'Попробуйте другой трек или проверьте настройки SoundCloud'
      );
    } else {
      notifications.showWarning(
        'Ошибка воспроизведения',
        `"${track.title}" недоступен`,
        'Трек может быть заблокирован правообладателем или недоступен в вашем регионе'
      );
    }
  } else {
    return notifications.handlePlaybackError(track, error);
  }
};

export const getLyricsByUrl = async (url) => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Загрузка текста', 'Загружаем выбранный текст...');
    const response = await fetch(`${API_BASE_URL}/lyrics/by-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        notifications.showSuccess('Текст загружен', 'Альтернативный текст успешно загружен');
      }
      return data;
    } else if (response.status === 404) {
      const data = await response.json();
      notifications.showWarning('Текст недоступен', 'Выбранный текст недоступен');
      return data;
    } else {
      throw new Error(`Lyrics error: ${response.status}`);
    }
  } catch (error) {
    console.error('Error getting lyrics by URL:', error);
    notifications.showError('Ошибка загрузки', 'Не удалось загрузить выбранный текст');
    return { success: false, error: error.message };
  }
};

export const searchLyrics = async (title, artist) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/lyrics/search?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist || '')}`
    );

    if (response.ok) {
      return await response.json();
    } else {
      throw new Error(`Search error: ${response.status}`);
    }
  } catch (error) {
    console.error('Error searching lyrics:', error);
    return { success: false, error: error.message, results: [] };
  }
};

export const searchSoundCloudPlaylists = async (query) => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Поиск плейлистов', 'Ищем плейлисты на SoundCloud...');
    const response = await fetch(`${API_BASE_URL}/soundcloud/search-playlists?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`Search error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      const playlistCount = data.playlists?.length || 0;
      if (playlistCount === 0) {
        notifications.showWarning('Поиск завершен', 'Плейлистов не найдено', `Запрос: "${query}"`);
      } else {
        notifications.showSuccess('Поиск завершен', `Найдено ${playlistCount} плейлистов`, `Запрос: "${query}"`);
      }
      return data.playlists || [];
    } else {
      notifications.showError('Ошибка поиска', data.error || 'Не удалось найти плейлисты');
      return [];
    }
  } catch (error) {
    console.error('Error searching SoundCloud playlists:', error);
    notifications.handleApiError(error, 'SoundCloud Playlist Search');
    return [];
  }
};

export const getSoundCloudPlaylistDetails = async (playlistId) => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Загрузка плейлиста', 'Получаем полную информацию о плейлисте...');
    const response = await fetch(`${API_BASE_URL}/soundcloud/playlist-details?id=${encodeURIComponent(playlistId)}`);
    
    if (!response.ok) {
      throw new Error(`Playlist details error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      notifications.showSuccess('Плейлист загружен', `"${data.playlist.title}" готов к просмотру`, `Треков: ${data.playlist.tracks.length}`);
      return data.playlist;
    } else {
      notifications.showError('Ошибка загрузки', data.error || 'Не удалось загрузить плейлист');
      return null;
    }
  } catch (error) {
    console.error('Error getting SoundCloud playlist details:', error);
    notifications.handleApiError(error, 'SoundCloud Playlist Details');
    return null;
  }
};

export const searchYouTubePlaylists = async (query) => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Поиск плейлистов', 'Ищем плейлисты на YouTube...');
    const response = await fetch(`${API_BASE_URL}/youtube/search-playlists?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`Search error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      const playlistCount = data.playlists?.length || 0;
      if (playlistCount === 0) {
        notifications.showWarning('Поиск завершен', 'Плейлистов не найдено', `Запрос: "${query}"`);
      } else {
        notifications.showSuccess('Поиск завершен', `Найдено ${playlistCount} плейлистов`, `Запрос: "${query}"`);
      }
      return data.playlists || [];
    } else {
      notifications.showError('Ошибка поиска', data.error || 'Не удалось найти плейлисты');
      return [];
    }
  } catch (error) {
    console.error('Error searching YouTube playlists:', error);
    notifications.handleApiError(error, 'YouTube Playlist Search');
    return [];
  }
};

export const getYouTubePlaylistDetails = async (playlistId) => {
  const notifications = getNotifications();

  try {
    notifications.showInfo('Загрузка плейлиста', 'Получаем полную информацию о плейлисте...');
    const response = await fetch(`${API_BASE_URL}/youtube/playlist-details?id=${encodeURIComponent(playlistId)}`);
    
    if (!response.ok) {
      throw new Error(`Playlist details error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      notifications.showSuccess('Плейлист загружен', `"${data.playlist.title}" готов к просмотру`, `Треков: ${data.playlist.tracks.length}`);
      return data.playlist;
    } else {
      notifications.showError('Ошибка загрузки', data.error || 'Не удалось загрузить плейлист');
      return null;
    }
  } catch (error) {
    console.error('Error getting YouTube playlist details:', error);
    notifications.handleApiError(error, 'YouTube Playlist Details');
    return null;
  }
};

export const exportAllData = async () => {
  const notifications = getNotifications();
  try {
    const response = await fetch(`${API_BASE_URL}/export-all-data`);
    if (!response.ok) {
      throw new Error(`Export error: ${response.status}`);
    }
    const result = await response.json();
    if (result.success) {
      const dataStr = JSON.stringify(result.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mblade-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      notifications.showSuccess('Экспорт завершен', 'Все данные приложения экспортированы');
      return { success: true };
    }
    throw new Error('Export failed');
  } catch (error) {
    console.error('Error exporting data:', error);
    notifications.handleApiError(error, 'Экспорт данных');
    return { success: false, error: error.message };
  }
};

export const importAllData = async (file) => {
  const notifications = getNotifications();
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.export_version) {
      throw new Error('Неверный формат файла экспорта');
    }
    
    const response = await fetch(`${API_BASE_URL}/import-all-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    
    if (!response.ok) {
      throw new Error(`Import error: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
      notifications.showSuccess('Импорт завершен', 'Все данные успешно импортированы', 'Перезагрузите страницу для применения изменений');
      return { success: true };
    }
    throw new Error(result.error || 'Import failed');
  } catch (error) {
    console.error('Error importing data:', error);
    notifications.handleApiError(error, 'Импорт данных');
    return { success: false, error: error.message };
  }
};

// Yandex Music API Functions
export const getYandexMusicAuthStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/yandex-music/auth-status`);
    if (!response.ok) {
      throw new Error(`Auth status error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting Yandex Music auth status:', error);
    return { authenticated: false, error: error.message };
  }
};

export const loginYandexMusic = async (token) => {
  const notifications = getNotifications();
  
  try {
    notifications.showInfo('Аутентификация', 'Подключаемся к Яндекс.Музыке...');
    
    const response = await fetch(`${API_BASE_URL}/yandex-music/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    
    const result = await response.json();
    
    if (result.success) {
      notifications.showSuccess(
        'Подключение успешно',
        'Вы успешно подключились к Яндекс.Музыке',
        result.account ? `Аккаунт: ${result.account.display_name || result.account.login}` : ''
      );
    } else {
      notifications.showError('Ошибка подключения', result.error || 'Не удалось подключиться к Яндекс.Музыке');
    }
    
    return result;
  } catch (error) {
    console.error('Error logging into Yandex Music:', error);
    notifications.handleApiError(error, 'Yandex Music Login');
    return { success: false, error: error.message };
  }
};

export const logoutYandexMusic = async () => {
  const notifications = getNotifications();
  
  try {
    const response = await fetch(`${API_BASE_URL}/yandex-music/logout`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.success) {
      notifications.showSuccess('Отключение завершено', 'Вы отключились от Яндекс.Музыки');
    } else {
      notifications.showError('Ошибка отключения', result.error || 'Не удалось отключиться от Яндекс.Музыки');
    }
    
    return result;
  } catch (error) {
    console.error('Error logging out of Yandex Music:', error);
    notifications.handleApiError(error, 'Yandex Music Logout');
    return { success: false, error: error.message };
  }
};

export const getYandexMusicPlaylists = async () => {
  const notifications = getNotifications();
  
  try {
    notifications.showInfo('Яндекс.Музыка', 'Получаем ваши плейлисты...');
    
    const response = await fetch(`${API_BASE_URL}/yandex-music/playlists`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch playlists: ${response.status}`);
    }
    
    const playlists = await response.json();
    
    notifications.showSuccess('Яндекс.Музыка', `Получено ${playlists.length} плейлистов`);
    
    return playlists;
    
  } catch (error) {
    console.error('Error fetching Yandex Music playlists:', error);
    notifications.handleApiError(error, 'Получение плейлистов Яндекс.Музыки');
    throw error;
  }
};

export const getYandexMusicLikedTracks = async () => {
  const notifications = getNotifications();
  
  try {
    notifications.showInfo('Яндекс.Музыка', 'Получаем ваши любимые треки...');
    
    const response = await fetch(`${API_BASE_URL}/yandex-music/liked-tracks`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch liked tracks: ${response.status}`);
    }
    
    const tracks = await response.json();
    
    notifications.showSuccess('Яндекс.Музыка', `Получено ${tracks.length} любимых треков`);
    
    return tracks;
    
  } catch (error) {
    console.error('Error fetching Yandex Music liked tracks:', error);
    notifications.handleApiError(error, 'Получение любимых треков Яндекс.Музыки');
    throw error;
  }
};

// Yandex Music Wave API Functions
export const startYandexWave = async (settings = {}) => {
  try {
    const url = new URL(`${API_BASE_URL}/yandex-music/wave/start`);
    
    // Добавляем параметры настроек как query parameters
    if (settings.mood) {
      url.searchParams.append('mood', settings.mood);
    }
    if (settings.character) {
      url.searchParams.append('character', settings.character);
    }
    
    console.log('[API] Starting wave with settings:', settings, 'URL:', url.toString());
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Wave start error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('Error starting Yandex Music wave:', error);
    return { success: false, error: error.message };
  }
};

export const getYandexRecommendations = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/yandex-music/recommendations`);
    
    if (!response.ok) {
      throw new Error(`Recommendations error: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
    
  } catch (error) {
    console.error('Error getting Yandex Music recommendations:', error);
    return { success: false, error: error.message };
  }
};

export const yandexWaveFeedback = async (trackId, feedbackType, playedSeconds = null, trackDuration = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/yandex-music/wave/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        trackId, 
        type: feedbackType, // 'trackStarted', 'trackFinished', 'like', 'dislike', 'skip'
        playedSeconds,
        trackDuration
      })
    });
    
    if (!response.ok) {
      throw new Error(`Feedback error: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error sending Yandex Music wave feedback:', error);
    return { success: false, error: error.message };
  }
};