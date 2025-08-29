import os
import json
import requests
import tempfile
import re
import time
from flask import request, jsonify, redirect, Response, send_file
import urllib.parse

SC_API_URL = "https://api-v2.soundcloud.com"
SC_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json"
}

def get_soundcloud_client_id(settings_file=None):
    try:
        if settings_file and os.path.exists(settings_file):
            with open(settings_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if 'client_id' in data:
                    return data['client_id']
        return None
    except Exception as e:
        print(f"[SC] Error reading client ID: {e}")
        return None

def save_soundcloud_client_id(client_id, settings_file=None):
    try:
        data = {'client_id': client_id}
        if settings_file:
            os.makedirs(os.path.dirname(settings_file), exist_ok=True)
            with open(settings_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[SC] Error saving client ID: {e}")
        return False



def search_soundcloud_playlists_fast(query, client_id=None, limit=20):
    """Быстрый поиск плейлистов на SoundCloud - только базовая информация"""
    if not client_id:
        return []
    
    url = f"{SC_API_URL}/search/playlists"
    
    params = {
        "q": query,
        "client_id": client_id,
        "limit": limit
        # Не используем "representation": "full" для быстрого поиска
    }
    
    try:
        print(f"[SC] Быстрый поиск плейлистов: '{query}'")
        response = requests.get(url, params=params, headers=SC_HEADERS)
        
        if response.status_code != 200:
            print(f"[SC] Ошибка поиска плейлистов: {response.status_code}")
            return []
        
        data = response.json()
        playlists = data.get("collection", [])
        
        formatted_playlists = []
        for playlist_data in playlists:
            formatted_playlist = format_playlist_data_basic(playlist_data)
            if formatted_playlist:
                formatted_playlists.append(formatted_playlist)
        
        print(f"[SC] Найдено {len(formatted_playlists)} плейлистов (быстрый поиск)")
        return formatted_playlists
        
    except Exception as e:
        print(f"[SC] Ошибка быстрого поиска плейлистов: {e}")
        return []

def search_soundcloud_playlists(query, client_id=None, limit=20):
    """Поиск плейлистов на SoundCloud с полной загрузкой треков (УСТАРЕЛО - используйте search_soundcloud_playlists_fast)"""
    if not client_id:
        return []
    
    url = f"{SC_API_URL}/search/playlists"
    
    params = {
        "q": query,
        "client_id": client_id,
        "limit": limit,
        "representation": "full"  # Запрашиваем полные данные сразу
    }
    
    try:
        print(f"[SC] Поиск плейлистов: '{query}'")
        response = requests.get(url, params=params, headers=SC_HEADERS)
        
        if response.status_code != 200:
            print(f"[SC] Ошибка поиска плейлистов: {response.status_code}")
            return []
        
        data = response.json()
        playlists = data.get("collection", [])
        
        formatted_playlists = []
        for playlist_data in playlists:
            # Если у плейлиста есть только первые треки, загружаем полную версию
            if playlist_data.get("track_count", 0) > 5 and len(playlist_data.get("tracks", [])) <= 5:
                print(f"[SC] Загружаем полные данные для плейлиста: {playlist_data.get('title', 'Unknown')}")
                full_playlist = get_soundcloud_playlist_details(playlist_data.get("id"), client_id)
                if full_playlist:
                    formatted_playlists.append(full_playlist)
                else:
                    # Если не удалось загрузить полные данные, используем частичные
                    formatted_playlist = format_playlist_data(playlist_data, client_id)
                    if formatted_playlist:
                        formatted_playlists.append(formatted_playlist)
            else:
                # Плейлист уже содержит все треки или их мало
                formatted_playlist = format_playlist_data(playlist_data, client_id)
                if formatted_playlist:
                    formatted_playlists.append(formatted_playlist)
        
        print(f"[SC] Найдено {len(formatted_playlists)} плейлистов")
        return formatted_playlists
        
    except Exception as e:
        print(f"[SC] Ошибка поиска плейлистов: {e}")
        return []

def format_playlist_data_basic(playlist_data):
    """Быстрое форматирование базовой информации о плейлисте"""
    if not playlist_data or playlist_data.get('kind') != 'playlist':
        return None
    
    playlist_id = playlist_data.get("id", "")
    title = playlist_data.get("title", "Untitled Playlist")
    user = playlist_data.get("user", {})
    author = user.get("username", "Unknown")
    artwork_url = playlist_data.get("artwork_url") or ""
    track_count = playlist_data.get("track_count", 0)
    permalink_url = playlist_data.get("permalink_url", "")
    
    # Обрабатываем обложку
    if artwork_url:
        artwork_url = artwork_url.replace("large", "t500x500")
    
    return {
        "id": str(playlist_id),
        "title": title,
        "author": author,
        "thumbnail": artwork_url,
        "track_count": track_count,
        "tracks": [],  # Пустой массив для быстрого поиска
        "url": permalink_url,
        "platform": "soundcloud"
    }

def format_playlist_data(playlist_data, client_id=None):
    """Форматирование данных плейлиста для клиента"""
    if not playlist_data or playlist_data.get('kind') != 'playlist':
        return None
    
    playlist_id = playlist_data.get("id", "")
    title = playlist_data.get("title", "Untitled Playlist")
    user = playlist_data.get("user", {})
    author = user.get("username", "Unknown")
    artwork_url = playlist_data.get("artwork_url") or ""
    track_count = playlist_data.get("track_count", 0)
    permalink_url = playlist_data.get("permalink_url", "")
    
    # Обрабатываем обложку
    if artwork_url:
        artwork_url = artwork_url.replace("large", "t500x500")
    
    # Получаем информацию о треках
    tracks = []
    if "tracks" in playlist_data and playlist_data["tracks"]:
        tracks_data = playlist_data["tracks"]
        
        # Если треков много, форматируем все
        for track_data in tracks_data:
            if client_id and len(tracks_data) > 5:
                # Для больших плейлистов используем полное форматирование
                formatted_track = format_track_data(track_data, client_id)
            else:
                # Для маленьких плейлистов используем быстрое форматирование
                formatted_track = format_track_data_fast(track_data)
                
            if formatted_track:
                tracks.append(formatted_track)
    
    return {
        "id": str(playlist_id),
        "title": title,
        "author": author,
        "thumbnail": artwork_url,
        "track_count": len(tracks),  # Используем реальное количество загруженных треков
        "tracks": tracks,
        "url": permalink_url,
        "platform": "soundcloud"
    }

def get_soundcloud_playlist_details(playlist_id, client_id):
    """Получить полную информацию о плейлисте включая все треки"""
    if not client_id:
        return None
    
    url = f"{SC_API_URL}/playlists/{playlist_id}"
    params = {
        "client_id": client_id,
        "representation": "full"
    }
    
    try:
        print(f"[SC] Загрузка полной информации о плейлисте: {playlist_id}")
        response = requests.get(url, params=params, headers=SC_HEADERS)
        
        if response.status_code != 200:
            print(f"[SC] Ошибка загрузки плейлиста: {response.status_code}")
            return None
        
        playlist_data = response.json()
        
        if playlist_data.get('kind') != 'playlist':
            return None
        
        # Форматируем базовую информацию
        formatted_playlist = format_playlist_data(playlist_data)
        if not formatted_playlist:
            return None
        
        # Загружаем все треки с батчевым запросом для неполных треков
        all_tracks = []
        tracks_data = playlist_data.get("tracks", [])
        incomplete_track_ids = []
        
        # Первый проход - обрабатываем все треки и собираем ID неполных
        for track_data in tracks_data:
            if not track_data:
                continue
            
            track_id = track_data.get("id", "")
            title = track_data.get("title", "").strip()
            user = track_data.get("user", {})
            
            # Если трек неполный (нет названия или пользователя), добавляем в список для батчевого запроса
            if not title or title == "Untitled" or not user:
                if track_id:
                    incomplete_track_ids.append(str(track_id))
            
            # Форматируем как есть
            formatted_track = format_track_data_fast(track_data)
            if formatted_track:
                all_tracks.append(formatted_track)
        
        # Батчевый запрос для неполных треков
        if incomplete_track_ids:
            print(f"[SC] Получаем полную информацию для {len(incomplete_track_ids)} неполных треков...")
            
            # Разбиваем на батчи по 50 треков
            batch_size = 50
            full_tracks_dict = {}
            
            for i in range(0, len(incomplete_track_ids), batch_size):
                batch_ids = incomplete_track_ids[i:i + batch_size]
                
                try:
                    ids_str = ",".join(batch_ids)
                    batch_url = f"{SC_API_URL}/tracks"
                    params = {
                        'ids': ids_str,
                        'client_id': client_id
                    }
                    
                    response = requests.get(batch_url, params=params, headers=SC_HEADERS)
                    
                    if response.status_code == 200:
                        batch_tracks = response.json()
                        for track in batch_tracks:
                            if track:
                                full_tracks_dict[str(track.get('id'))] = track
                        print(f"[SC] Получено {len(batch_tracks)} треков в батче {i//batch_size + 1}")
                    else:
                        print(f"[SC] Ошибка батча {i//batch_size + 1}: {response.status_code}")
                        
                except Exception as e:
                    print(f"[SC] Ошибка батчевого запроса {i//batch_size + 1}: {e}")
            
            # Обновляем неполные треки
            updated_count = 0
            for i, track in enumerate(all_tracks):
                if track['id'] in full_tracks_dict:
                    full_track = full_tracks_dict[track['id']]
                    updated_track = format_track_data_fast(full_track)
                    if updated_track:
                        all_tracks[i] = updated_track
                        updated_count += 1
            
            print(f"[SC] Обновлено {updated_count} треков в плейлисте")
        
        # Обновляем список треков полными данными
        formatted_playlist["tracks"] = all_tracks
        formatted_playlist["track_count"] = len(all_tracks)
        
        print(f"[SC] Загружен плейлист '{formatted_playlist['title']}' с {len(all_tracks)} треками")
        return formatted_playlist
        
    except Exception as e:
        print(f"[SC] Ошибка загрузки деталей плейлиста: {e}")
        return None

def search_soundcloud(query, client_id=None):
    if not client_id:
        return []
    
    url = f"{SC_API_URL}/search/tracks"
    
    params = {
        "q": query,
        "client_id": client_id,
        "limit": 10
    }
    
    try:
        r = requests.get(url, params=params, headers=SC_HEADERS)
        if r.status_code != 200:
            return []
        
        data = r.json()
        if "collection" not in data:
            return []
        
        out = []
        for track in data["collection"]:
            track_id = track.get("id", "")
            title = track.get("title", "Untitled")
            duration_ms = track.get("duration", 0)
            duration_sec = duration_ms // 1000
            user = track.get("user", {})
            artist = user.get("username", "Unknown")
            artwork_url = track.get("artwork_url") or ""
            if artwork_url:
                artwork_url = artwork_url.replace("large", "t500x500")
            
            out.append({
                "id": str(track_id),
                "title": title,
                "duration": duration_sec,
                "uploader": artist,
                "thumbnail": artwork_url,
                "platform": "soundcloud",
                "url": track.get("permalink_url", ""),
                "streamable": track.get("streamable", False)
            })
        
        return out
    except Exception as e:
        print(f"[SC] Search error: {e}")
        return []

def get_soundcloud_stream_url(track_id, client_id=None):
    if not client_id:
        return None
    
    try:
        url = f"{SC_API_URL}/tracks/{track_id}"
        params = {"client_id": client_id}
        
        r = requests.get(url, params=params, headers=SC_HEADERS)
        if r.status_code != 200:
            return None
        
        track_data = r.json()
        
        if not track_data.get("streamable", False):
            return None
        
        media_url = track_data.get("media", {}).get("transcodings", [])
        progressive_urls = [t for t in media_url if t.get("format", {}).get("protocol") == "progressive"]
        
        if not progressive_urls:
            return None
        
        best_quality = sorted(
            progressive_urls,
            key=lambda x: x.get("quality", ""),
            reverse=True
        )[0]
        
        stream_url = best_quality.get("url")
        if not stream_url:
            return None
        
        stream_params = {"client_id": client_id}
        sr = requests.get(stream_url, params=stream_params, headers=SC_HEADERS)
        
        if sr.status_code != 200:
            return None
        
        stream_data = sr.json()
        direct_url = stream_data.get("url")
        
        return direct_url
    except Exception as e:
        print(f"[SC] Error getting stream URL: {e}")
        return None

def get_soundcloud_stream_url_with_error_info(track_id, client_id=None):
    if not client_id:
        return None, "SoundCloud Client ID не установлен"
    
    try:
        url = f"{SC_API_URL}/tracks/{track_id}"
        params = {"client_id": client_id}
        
        r = requests.get(url, params=params, headers=SC_HEADERS)
        
        if r.status_code == 404:
            return None, "Трек не найден или удален"
        elif r.status_code == 403:
            return None, "Доступ к треку ограничен правообладателем"
        elif r.status_code != 200:
            return None, f"Ошибка SoundCloud API: {r.status_code}"
        
        track_data = r.json()
        
        if not track_data.get("streamable", False):
            sharing = track_data.get("sharing", "")
            if sharing == "private":
                return None, "Трек приватный и недоступен для воспроизведения"
            else:
                return None, "Трек недоступен для стриминга по решению правообладателя"
        
        state = track_data.get("state", "")
        if state != "finished":
            if state == "processing":
                return None, "Трек еще обрабатывается на SoundCloud"
            elif state == "failed":
                return None, "Обработка трека не удалась"
            else:
                return None, f"Трек недоступен (статус: {state})"
        
        if track_data.get("policy") == "BLOCK":
            return None, "Трек заблокирован в вашем регионе"
        
        media_transcodings = track_data.get("media", {}).get("transcodings", [])
        if not media_transcodings:
            return None, "Нет доступных форматов для воспроизведения"
        
        progressive_urls = [t for t in media_transcodings 
                          if t.get("format", {}).get("protocol") == "progressive"]
        
        if not progressive_urls:
            return None, "Трек доступен только в потоковом формате (HLS), который не поддерживается"
        
        best_quality = sorted(
            progressive_urls,
            key=lambda x: x.get("quality", ""),
            reverse=True
        )[0]
        
        stream_url = best_quality.get("url")
        if not stream_url:
            return None, "Не удалось получить ссылку на поток"
        
        stream_params = {"client_id": client_id}
        sr = requests.get(stream_url, params=stream_params, headers=SC_HEADERS)
        
        if sr.status_code != 200:
            return None, "Ошибка получения прямой ссылки на аудиофайл"
        
        stream_data = sr.json()
        direct_url = stream_data.get("url")
        
        if not direct_url:
            return None, "Не удалось получить прямую ссылку на аудиофайл"
        
        return direct_url, None
        
    except requests.RequestException as e:
        return None, f"Ошибка сети: {str(e)}"
    except Exception as e:
        return None, f"Неожиданная ошибка: {str(e)}"

def get_soundcloud_track_info(track_id, client_id=None):
    if not client_id:
        return None
    
    try:
        url = f"{SC_API_URL}/tracks/{track_id}"
        params = {"client_id": client_id}
        
        r = requests.get(url, params=params, headers=SC_HEADERS)
        if r.status_code != 200:
            return None
        
        track_data = r.json()
        
        title = track_data.get("title", "Unknown")
        user = track_data.get("user", {})
        artist = user.get("username", "Unknown")
        
        return {
            'title': title,
            'artist': artist,
            'duration': track_data.get("duration", 0) // 1000,
            'streamable': track_data.get("streamable", False),
            'permalink_url': track_data.get("permalink_url", "")
        }
    except Exception as e:
        return None

def download_soundcloud_audio(track_id, client_id=None):
    try:
        print(f"[SC_DL] Starting download for {track_id}")
        
        track_info = get_soundcloud_track_info(track_id, client_id)
        if not track_info:
            raise Exception("Could not get track info")
        
        if not track_info.get('streamable', False):
            raise Exception("Track is not streamable")
        
        direct_url, error_msg = get_soundcloud_stream_url_with_error_info(track_id, client_id)
        if not direct_url:
            raise Exception(error_msg or "Could not get stream URL")
        
        title = track_info.get('title', 'Unknown')
        artist = track_info.get('artist', 'Unknown')
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        temp_path = temp_file.name
        temp_file.close()
        
        print(f"[SC_DL] Downloading from {direct_url[:100]}... to {temp_path}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://soundcloud.com/',
        }
        
        response = requests.get(direct_url, headers=headers, stream=True, timeout=30)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        downloaded = 0
        start_time = time.time()
        
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    
                    # Проверка таймаута (5 минут максимум)
                    if time.time() - start_time > 300:
                        raise Exception("Download timeout exceeded (5 minutes)")
                    
                    if total_size > 0:
                        progress = (downloaded / total_size) * 100
                        if downloaded % (1024 * 1024) == 0:  # Каждые 1MB
                            print(f"[SC_DL] Progress: {progress:.1f}% ({downloaded}/{total_size} bytes)")
        
        file_size = os.path.getsize(temp_path)
        print(f"[SC_DL] Downloaded {file_size} bytes for {track_id}")
        
        if file_size < 1024:
            raise Exception(f"Downloaded file too small: {file_size} bytes")
        
        safe_title = ''.join(c for c in title if c.isalnum() or c in ' ._-').strip()
        safe_artist = ''.join(c for c in artist if c.isalnum() or c in ' ._-').strip()
        
        if not safe_title:
            safe_title = track_id
        
        if safe_artist and safe_artist != 'Unknown':
            filename = f"{safe_artist} - {safe_title}.mp3"
        else:
            filename = f"{safe_title}.mp3"
        
        filename = filename[:200] + ".mp3" if len(filename) > 200 else filename
        
        return {
            'file_path': temp_path,
            'filename': filename,
            'title': title,
            'artist': artist,
            'size': file_size
        }
        
    except Exception as e:
        print(f"[SC_DL] Error downloading {track_id}: {e}")
        if 'temp_path' in locals() and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
        raise

def extract_username_from_url(url):
    patterns = [
        r'soundcloud\.com/([^/]+)/likes',
        r'soundcloud\.com/([^/]+)/?$'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    raise Exception("Could not extract username from URL")

def get_track_full_info(track_id, client_id):
    try:
        url = f"{SC_API_URL}/tracks/{track_id}"
        params = {"client_id": client_id}
        
        response = requests.get(url, params=params, headers=SC_HEADERS)
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except Exception:
        return None

def format_track_data(track_data, client_id=None):
    if not track_data:
        return None
    
    track_id = track_data.get("id", "")
    title = track_data.get("title", "")
    
    if (not title or title == "Untitled" or not track_data.get("user")) and track_id and client_id:
        full_track_data = get_track_full_info(track_id, client_id)
        if full_track_data:
            track_data = full_track_data
    
    if track_data.get('kind') != 'track':
        return None
    
    track_id = track_data.get("id", "")
    title = track_data.get("title", "Untitled")
    duration_ms = track_data.get("duration", 0)
    duration_sec = duration_ms // 1000
    user = track_data.get("user", {})
    artist = user.get("username", "Unknown")
    artwork_url = track_data.get("artwork_url") or ""
    
    if artwork_url:
        artwork_url = artwork_url.replace("large", "t500x500")
    
    return {
        "id": str(track_id),
        "title": title,
        "duration": duration_sec,
        "uploader": artist,
        "thumbnail": artwork_url,
        "platform": "soundcloud",
        "url": track_data.get("permalink_url", "")
    }

def format_track_data_fast(track_data):
    """Быстрое форматирование трека без дополнительных API запросов и фильтров"""
    if not track_data:
        return None
    
    # Минимальная проверка - только что это трек
    if track_data.get('kind') != 'track':
        return None
    
    track_id = track_data.get("id", "")
    if not track_id:
        return None
    
    # Получаем информацию как есть, без фильтров
    title = track_data.get("title", "Untitled")
    duration_ms = track_data.get("duration", 0)
    duration_sec = duration_ms // 1000 if duration_ms else 0
    
    user = track_data.get("user", {})
    artist = user.get("username", "Unknown") if user else "Unknown"
    
    artwork_url = track_data.get("artwork_url") or ""
    if artwork_url:
        artwork_url = artwork_url.replace("large", "t500x500")
    
    return {
        "id": str(track_id),
        "title": title,
        "duration": duration_sec,
        "uploader": artist,
        "thumbnail": artwork_url,
        "platform": "soundcloud",
        "url": track_data.get("permalink_url", "")
    }

def import_playlist(playlist_data, client_id):
    playlist_name = playlist_data.get('title', 'SoundCloud Playlist')
    
    print(f"[SC] Импорт плейлиста '{playlist_name}'...")
    
    # Используем треки прямо из данных resolve
    all_tracks = playlist_data.get('tracks', [])
    print(f"[SC] Найдено {len(all_tracks)} треков в данных плейлиста")
    
    tracks = []
    incomplete_track_ids = []
    
    # Первый проход - обрабатываем все треки и собираем ID неполных
    for track_data in all_tracks:
        if not track_data:
            continue
        
        track_id = track_data.get("id", "")
        title = track_data.get("title", "").strip()
        user = track_data.get("user", {})
        
        # Если трек неполный (нет названия или пользователя), добавляем в список для батчевого запроса
        if not title or title == "Untitled" or not user:
            if track_id:
                incomplete_track_ids.append(str(track_id))
        
        # Форматируем как есть
        track = format_track_data_fast(track_data)
        if track:
            tracks.append(track)
    
    # Батчевый запрос для неполных треков
    if incomplete_track_ids:
        print(f"[SC] Получаем полную информацию для {len(incomplete_track_ids)} неполных треков...")
        
        # Разбиваем на батчи по 50 треков
        batch_size = 50
        full_tracks_dict = {}
        
        for i in range(0, len(incomplete_track_ids), batch_size):
            batch_ids = incomplete_track_ids[i:i + batch_size]
            
            try:
                ids_str = ",".join(batch_ids)
                batch_url = f"{SC_API_URL}/tracks"
                params = {
                    'ids': ids_str,
                    'client_id': client_id
                }
                
                response = requests.get(batch_url, params=params, headers=SC_HEADERS)
                
                if response.status_code == 200:
                    batch_tracks = response.json()
                    for track in batch_tracks:
                        if track:
                            full_tracks_dict[str(track.get('id'))] = track
                    print(f"[SC] Получено {len(batch_tracks)} треков в батче {i//batch_size + 1}")
                else:
                    print(f"[SC] Ошибка батча {i//batch_size + 1}: {response.status_code}")
                    
            except Exception as e:
                print(f"[SC] Ошибка батчевого запроса {i//batch_size + 1}: {e}")
        
        # Обновляем неполные треки
        updated_count = 0
        for i, track in enumerate(tracks):
            if track['id'] in full_tracks_dict:
                full_track = full_tracks_dict[track['id']]
                updated_track = format_track_data_fast(full_track)
                if updated_track:
                    tracks[i] = updated_track
                    updated_count += 1
        
        print(f"[SC] Обновлено {updated_count} треков")
    
    print(f"[SC] Импорт завершен: {len(tracks)} треков")
    
    return {
        "success": True,
        "playlist": {
            "name": playlist_name,
            "tracks": tracks
        }
    }

def import_user_likes_by_id(user_id, username, client_id):
    print(f"[SC] Импорт лайков пользователя {username}...")
    
    all_tracks = []
    
    endpoints_to_try = [
        f"{SC_API_URL}/users/{user_id}/favorites",
        f"{SC_API_URL}/users/{user_id}/likes",
        f"{SC_API_URL}/users/{user_id}/track_likes"
    ]
    
    for endpoint in endpoints_to_try:
        try:
            offset = 0
            limit = 200
            found_tracks = False
            
            while True:
                params = {
                    'client_id': client_id,
                    'limit': limit,
                    'offset': offset,
                    'linked_partitioning': 1
                }
                
                response = requests.get(endpoint, params=params, headers=SC_HEADERS)
                
                if response.status_code != 200:
                    break
                
                data = response.json()
                collection = data.get('collection', [])
                
                if not collection:
                    break
                
                found_tracks = True
                
                for item in collection:
                    if item.get('kind') == 'track':
                        all_tracks.append(item)
                    elif 'track' in item and item['track'].get('kind') == 'track':
                        all_tracks.append(item['track'])
                    elif item.get('type') == 'track-like' and 'track' in item:
                        all_tracks.append(item['track'])
                
                next_href = data.get('next_href')
                if not next_href or len(collection) < limit:
                    break
                
                offset += limit
                
                if offset > 5000:
                    break
            
            if found_tracks and all_tracks:
                break
                
        except Exception:
            continue
    
    if not all_tracks:
        return {
            "success": False,
            "error": "Could not access user's liked tracks. The profile might be private or the user has no liked tracks."
        }
    
    formatted_tracks = []
    for track_data in all_tracks:            
        track = format_track_data_fast(track_data)
        if track:
            formatted_tracks.append(track)
    
    playlist_name = f"{username} - Liked Tracks"
    
    print(f"[SC] Импорт завершен: {len(formatted_tracks)} лайков")
    
    return {
        "success": True,
        "playlist": {
            "name": playlist_name,
            "tracks": formatted_tracks
        }
    }

def import_user_likes(user_data, client_id):
    username = user_data.get('username', 'Unknown User')
    user_id = user_data.get('id')
    
    if not user_id:
        raise Exception("Could not get user ID")
    
    return import_user_likes_by_id(user_id, username, client_id)

def import_user_likes_by_username(username, client_id):
    user_url = f"{SC_API_URL}/resolve?url=https://soundcloud.com/{username}&client_id={client_id}"
    response = requests.get(user_url, headers=SC_HEADERS)
    
    if response.status_code != 200:
        raise Exception(f"Could not resolve user: {response.status_code}")
    
    user_data = response.json()
    user_id = user_data.get('id')
    
    if not user_id:
        raise Exception("Could not get user ID")
    
    return import_user_likes_by_id(user_id, username, client_id)

def import_soundcloud_playlist(playlist_url, client_id):
    try:
        if '?' in playlist_url:
            playlist_url = playlist_url.split('?')[0]
        
        if not playlist_url.startswith('http'):
            playlist_url = f"https://soundcloud.com/{playlist_url}"
        
        print(f"[SC] Начало импорта с URL: {playlist_url}")
        
        resolve_url = f"{SC_API_URL}/resolve"
        params = {
            'url': playlist_url,
            'client_id': client_id
        }
        
        response = requests.get(resolve_url, params=params, headers=SC_HEADERS)
        
        if response.status_code != 200:
            raise Exception(f"Error resolving URL (status {response.status_code}). Make sure the URL is correct and the content is public.")
        
        data = response.json()
        kind = data.get('kind', '')
        
        if kind == 'playlist':
            return import_playlist(data, client_id)
        elif kind == 'user':
            if '/likes' in playlist_url or playlist_url.endswith('/likes'):
                return import_user_likes(data, client_id)
            else:
                raise Exception("For user URLs, add '/likes' at the end to import liked tracks (e.g., 'https://soundcloud.com/username/likes')")
        else:
            if '/likes' in playlist_url or playlist_url.endswith('/likes'):
                username = extract_username_from_url(playlist_url)
                return import_user_likes_by_username(username, client_id)
            else:
                raise Exception(f"Unsupported content type '{kind}'. Supported: playlists and user liked tracks (/likes)")
                
    except Exception as e:
        error_msg = str(e)
        print(f"[SC] Ошибка импорта: {error_msg}")
        return {"success": False, "error": error_msg}

def setup_soundcloud_routes(app, SOUNDCLOUD_SETTINGS_FILE, FFMPEG_DIR):
    print("[SC] Setting up SoundCloud routes...")
    @app.route('/api/stream/soundcloud', methods=['GET'])
    def stream_soundcloud():
        track_id = request.args.get('id', '').strip()
        if not track_id:
            return jsonify({
                "error": "Track ID is required",
                "user_message": "Не указан ID трека"
            }), 400
        
        try:
            direct = request.args.get('direct', '').lower() in ('1', 'true', 'yes')
            
            client_id = get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)
            if not client_id:
                return jsonify({
                    "error": "SoundCloud Client ID not set",
                    "user_message": "SoundCloud Client ID не настроен"
                }), 500
            
            direct_url, error_message = get_soundcloud_stream_url_with_error_info(track_id, client_id)
            
            if not direct_url:
                print(f"[SC] Track {track_id} unavailable: {error_message}")
                return jsonify({
                    "error": "Track not available",
                    "user_message": error_message,
                    "track_id": track_id,
                    "platform": "soundcloud"
                }), 404
            
            if direct:
                return jsonify({"url": direct_url})
            
            return redirect(direct_url)
            
        except Exception as e:
            print(f"[SC] Unexpected error for track {track_id}: {e}")
            return jsonify({
                "error": "Internal server error",
                "user_message": "Внутренняя ошибка сервера",
                "track_id": track_id,
                "platform": "soundcloud"
            }), 500
    
    @app.route('/api/soundcloud/get-client-id', methods=['GET'])
    def soundcloud_get_client_id():
        client_id = get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)
        return jsonify({
            "is_set": bool(client_id),
            "client_id": client_id
        })
    
    @app.route('/api/soundcloud/save-client-id', methods=['POST'])
    def soundcloud_save_client_id():
        data = request.json
        if not data or 'client_id' not in data:
            return jsonify({"error": "Client ID is required"}), 400
        
        client_id = data['client_id']
        success = save_soundcloud_client_id(client_id, SOUNDCLOUD_SETTINGS_FILE)
        
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Failed to save Client ID"}), 500
    
    @app.route('/api/soundcloud/set-client-id', methods=['POST'])
    def soundcloud_set_client_id():
        """Alias for save-client-id endpoint for compatibility"""
        data = request.json
        if not data or 'client_id' not in data:
            return jsonify({"error": "Client ID is required"}), 400
        
        client_id = data['client_id']
        success = save_soundcloud_client_id(client_id, SOUNDCLOUD_SETTINGS_FILE)
        
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Failed to save Client ID"}), 500
    
    @app.route('/api/soundcloud/check-auth', methods=['GET'])
    def soundcloud_check_auth():
        """Check if SoundCloud client ID is set and working"""
        try:
            client_id = get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)
            
            if not client_id:
                return jsonify({
                    "is_authorized": False,
                    "client_id_set": False,
                    "message": "Client ID not set"
                })
            
            # Test the client ID by making a simple API request
            test_url = f"{SC_API_URL}/tracks"
            test_params = {
                'ids': '1',  # Test with a simple track ID
                'client_id': client_id
            }
            
            response = requests.get(test_url, params=test_params, headers=SC_HEADERS, timeout=5)
            
            if response.status_code == 200:
                return jsonify({
                    "is_authorized": True,
                    "client_id_set": True,
                    "message": "Client ID working"
                })
            elif response.status_code == 401:
                return jsonify({
                    "is_authorized": False,
                    "client_id_set": True,
                    "message": "Invalid Client ID"
                })
            else:
                return jsonify({
                    "is_authorized": False,
                    "client_id_set": True,
                    "message": f"API test failed with status {response.status_code}"
                })
                
        except Exception as e:
            print(f"[SC] Error checking auth: {e}")
            return jsonify({
                "is_authorized": False,
                "client_id_set": bool(get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)),
                "message": f"Error checking authorization: {str(e)}"
            }), 500
    
    @app.route('/api/soundcloud/reset-auth', methods=['POST'])
    def soundcloud_reset_auth():
        """Reset SoundCloud authorization by removing the client ID"""
        try:
            if os.path.exists(SOUNDCLOUD_SETTINGS_FILE):
                os.remove(SOUNDCLOUD_SETTINGS_FILE)
                print("[SC] Client ID file removed")
            
            return jsonify({
                "success": True,
                "message": "Authorization reset successfully"
            })
        except Exception as e:
            print(f"[SC] Error resetting auth: {e}")
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500
    
    @app.route('/api/soundcloud/get-track-info', methods=['GET'])
    def soundcloud_get_track_info():
        track_id = request.args.get('id', '').strip()
        if not track_id:
            return jsonify({"error": "Track ID is required"}), 400
        
        try:
            client_id = get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)
            if not client_id:
                return jsonify({"error": "SoundCloud Client ID not set"}), 500
            
            track_info = get_soundcloud_track_info(track_id, client_id)
            if not track_info:
                return jsonify({"error": "Track not found"}), 404
            
            return jsonify({
                "permalink_url": track_info.get("permalink_url", ""),
                "title": track_info.get("title", ""),
                "artist": track_info.get("artist", ""),
                "streamable": track_info.get("streamable", False)
            })
            
        except Exception as e:
            print(f"[SC] Error getting track info: {e}")
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/download/soundcloud', methods=['GET'])
    def download_soundcloud():
        track_id = request.args.get('id', '').strip()
        if not track_id:
            return jsonify({"error": "Track ID is required"}), 400
        
        temp_file_path = None
        try:
            client_id = get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)
            if not client_id:
                return jsonify({"error": "SoundCloud Client ID not set"}), 500
            
            print(f"[SC_DL] Download request for {track_id}")
            
            download_info = download_soundcloud_audio(track_id, client_id)
            temp_file_path = download_info['file_path']
            filename = download_info['filename']
            
            print(f"[SC_DL] Sending file: {filename} ({download_info.get('size', 0)} bytes)")
            
            def remove_temp_file():
                try:
                    if temp_file_path and os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                        print(f"[SC_DL] Cleaned up temp file: {temp_file_path}")
                except Exception as e:
                    print(f"[SC_DL] Error cleaning temp file: {e}")
            
            response = send_file(
                temp_file_path,
                as_attachment=True,
                download_name=filename,
                mimetype='audio/mpeg'
            )
            
            @response.call_on_close
            def cleanup(response):
                remove_temp_file()
            
            return response
            
        except Exception as e:
            print(f"[SC_DL] Download error: {str(e)}")
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
            
            error_message = str(e)
            error_code = 500
            
            if "timeout" in error_message.lower():
                error_code = 408
                user_message = "Скачивание прервано по таймауту"
            elif "too small" in error_message.lower():
                error_code = 422
                user_message = "Скачанный файл поврежден"
            elif "not streamable" in error_message.lower():
                error_code = 403
                user_message = "Трек недоступен для скачивания"
            elif "connection" in error_message.lower() or "network" in error_message.lower():
                error_code = 502
                user_message = "Ошибка сети при скачивании"
            else:
                user_message = "Ошибка скачивания"
            
            return jsonify({
                "error": error_message,
                "message": user_message, 
                "platform": "soundcloud"
            }), error_code
    
    @app.route('/api/soundcloud/import-playlist', methods=['POST'])
    def soundcloud_import_playlist():
        try:
            data = request.json
            if not data or 'url' not in data:
                return jsonify({"error": "Playlist URL is required"}), 400
            
            playlist_url = data['url']
            client_id = get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)
            
            if not client_id:
                return jsonify({
                    "error": "SoundCloud Client ID not set",
                    "is_client_id_set": False
                }), 400
            
            result = import_soundcloud_playlist(playlist_url, client_id)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/soundcloud/search-playlists', methods=['GET'])
    def soundcloud_search_playlists():
        try:
            query = request.args.get('query', '').strip()
            if not query:
                return jsonify({"error": "Search query is required"}), 400
            
            client_id = get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)
            if not client_id:
                return jsonify({
                    "success": False,
                    "error": "SoundCloud Client ID not set",
                    "playlists": []
                }), 200
            
            playlists = search_soundcloud_playlists_fast(query, client_id)
            return jsonify({
                "success": True,
                "playlists": playlists
            })
        except Exception as e:
            print(f"[SC] Error searching playlists: {e}")
            return jsonify({
                "success": False,
                "error": str(e),
                "playlists": []
            }), 500
    
    @app.route('/api/soundcloud/playlist-details', methods=['GET'])
    def soundcloud_playlist_details():
        try:
            playlist_id = request.args.get('id', '').strip()
            if not playlist_id:
                return jsonify({"error": "Playlist ID is required"}), 400
            
            client_id = get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)
            if not client_id:
                return jsonify({
                    "success": False,
                    "error": "SoundCloud Client ID not set"
                }), 400
            
            playlist = get_soundcloud_playlist_details(playlist_id, client_id)
            if not playlist:
                return jsonify({
                    "success": False,
                    "error": "Playlist not found or not accessible"
                }), 404
            
            return jsonify({
                "success": True,
                "playlist": playlist
            })
        except Exception as e:
            print(f"[SC] Error getting playlist details: {e}")
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500
    
    print("[SC] SoundCloud routes setup completed")
    return app