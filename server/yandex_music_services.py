import os
import json
import requests
import tempfile
import re
import time
from flask import request, jsonify, redirect, Response, send_file
import urllib.parse
from yandex_music import Client
from yandex_music.exceptions import NetworkError, UnauthorizedError

YM_SETTINGS_FILE = None  # Будет установлен при инициализации
YM_CLIENT = None  # Глобальный клиент Яндекс.Музыки

# Глобальные переменные для управления сессией роторы
from collections import deque
import time

# Роторная сессия для волны (с настройками пользователя)
YM_ROTOR_SESSION = {
    'session_id': None,
    'batch_id': None,
    'sequence_number': 0,
    'used_track_ids': set(),  # Треки которые реально проигрывались
    'seen_candidates': deque(maxlen=1200),  # LRU все треки из sequence (увеличено до 1200)
    'station_seed': None,
    'last_cursor': None,
    'last_feedback_time': 0,  # Время последнего успешного feedback
    'current_sequence': [],  # Текущая неиспользованная последовательность
    'can_request_more': True,  # Можно ли запрашивать новые треки
    'consecutive_empty_requests': 0,  # Счетчик пустых запросов подряд
    'last_unique_count_history': deque(maxlen=4),  # История количества уникальных треков за последние 4 запроса
    'current_settings': {}  # Текущие настройки волны
}

# Отдельная роторная сессия для рекомендаций (всегда с дефолтными настройками)
YM_RECOMMENDATIONS_SESSION = {
    'session_id': None,
    'batch_id': None,
    'sequence_number': 0,
    'station_seed': None,
    'last_cursor': None,
    'last_feedback_time': 0,
}

def get_yandex_music_token(settings_file=None):
    """Получить токен Яндекс.Музыки из файла настроек"""
    try:
        if settings_file and os.path.exists(settings_file):
            with open(settings_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if 'token' in data:
                    return data['token']
        return None
    except Exception as e:
        print(f"[YM] Error reading token: {e}")
        return None

def save_yandex_music_token(token, settings_file=None):
    """Сохранить токен Яндекс.Музыки в файл настроек"""
    try:
        data = {'token': token}
        if settings_file:
            os.makedirs(os.path.dirname(settings_file), exist_ok=True)
            with open(settings_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[YM] Error saving token: {e}")
        return False

def initialize_yandex_client(token):
    """Инициализировать клиент Яндекс.Музыки"""
    global YM_CLIENT
    try:
        if not token:
            return False
            
        YM_CLIENT = Client(token)
        # Проверяем валидность токена
        YM_CLIENT.account_status()
        print("[YM] Client initialized successfully")
        return True
    except UnauthorizedError:
        print("[YM] Invalid token")
        YM_CLIENT = None
        return False
    except Exception as e:
        print(f"[YM] Error initializing client: {e}")
        YM_CLIENT = None
        return False

def search_yandex_music(query, limit=20):
    """Поиск треков в Яндекс.Музыке"""
    if not YM_CLIENT:
        print("[YM] Client not initialized")
        return []
    
    try:
        print(f"[YM] Searching: '{query}'")
        search_result = YM_CLIENT.search(query, type_='track')
        
        if not search_result or not search_result.tracks:
            print("[YM] No tracks found")
            return []
        
        tracks = []
        for track in search_result.tracks.results[:limit]:
            formatted_track = format_yandex_track(track)
            if formatted_track:
                tracks.append(formatted_track)
        
        print(f"[YM] Found {len(tracks)} tracks")
        return tracks
        
    except Exception as e:
        print(f"[YM] Search error: {e}")
        return []

def format_yandex_track(track):
    """Форматировать трек Яндекс.Музыки в стандартный формат"""
    try:
        # Получаем информацию о треке
        title = getattr(track, 'title', 'Unknown Title') or "Unknown Title"
        
        artists = []
        if hasattr(track, 'artists') and track.artists:
            try:
                artists = [artist.name for artist in track.artists]
            except Exception as e:
                print(f"[YM] Error extracting artists for '{title}': {e}")
                artists = []
        
        artist = ", ".join(artists) if artists else "Unknown Artist"
        
        # Длительность в секундах
        duration = 0
        if hasattr(track, 'duration_ms') and track.duration_ms:
            duration = track.duration_ms // 1000
        
        # ID трека
        track_id = None
        if hasattr(track, 'track_id') and track.track_id:
            track_id = str(track.track_id)
        elif hasattr(track, 'id') and track.id:
            track_id = str(track.id)
        else:
            print(f"[YM] Warning: No valid ID found for track '{title}'")
            track_id = "unknown"
        
        # Обложка
        cover_uri = None
        if hasattr(track, 'cover_uri') and track.cover_uri:
            cover_uri = f"https://{track.cover_uri.replace('%%', '400x400')}"
        elif hasattr(track, 'albums') and track.albums and len(track.albums) > 0:
            try:
                album = track.albums[0]
                if hasattr(album, 'cover_uri') and album.cover_uri:
                    cover_uri = f"https://{album.cover_uri.replace('%%', '400x400')}"
            except:
                pass
        
        result = {
            "id": track_id,
            "title": title,
            "artist": artist,
            "duration": duration,
            "platform": "yandex_music",
            "thumbnail": cover_uri,
            "url": f"https://music.yandex.ru/track/{track_id}",
            "streamable": True
        }
        
        return result
        
    except Exception as e:
        print(f"[YM] Error formatting track: {e}")
        print(f"[YM] Track object attributes: {dir(track)}")
        return None

def get_yandex_track_download_info(track_id):
    """Получить информацию для загрузки трека"""
    if not YM_CLIENT:
        return None
    
    try:
        # Разбираем ID трека
        if ':' in track_id:
            actual_track_id, album_id = track_id.split(':', 1)
        else:
            actual_track_id = track_id
            album_id = None
        
        # Получаем информацию о загрузке
        download_info = YM_CLIENT.tracks_download_info(actual_track_id)
        
        if not download_info:
            return None
        
        # Ищем лучшее качество
        best_quality = None
        for info in download_info:
            if info.codec == 'mp3' and (not best_quality or info.bitrate_in_kbps > best_quality.bitrate_in_kbps):
                best_quality = info
        
        if not best_quality:
            return None
        
        # Получаем прямую ссылку на файл
        direct_link = best_quality.get_direct_link()
        
        return {
            'direct_link': direct_link,
            'codec': best_quality.codec,
            'bitrate': best_quality.bitrate_in_kbps,
            'size': getattr(best_quality, 'file_size', None)
        }
        
    except Exception as e:
        print(f"[YM] Error getting download info: {e}")
        return None

def stream_yandex_track(track_id):
    """Стримить трек Яндекс.Музыки"""
    try:
        download_info = get_yandex_track_download_info(track_id)
        if not download_info:
            return jsonify({"error": "Track not found or unavailable"}), 404
        
        direct_link = download_info['direct_link']
        
        # Получаем информацию о Range запросе
        from flask import request
        range_header = request.headers.get('Range')
        
        if range_header:
            # Обработка Range запросов для поддержки перемотки
            try:
                # Сначала получаем размер файла
                head_response = requests.head(direct_link, allow_redirects=True)
                print(f"[YM] Stream response ready: {head_response.status_code}")
                
                if head_response.status_code == 200:
                    content_length = int(head_response.headers.get('Content-Length', 0))
                    print(f"[YM] Stream size: {content_length/1024/1024:.1f}MB")
                else:
                    print(f"[YM] Stream request failed: {head_response.status_code}")
                    raise Exception("HEAD request failed")
                
                # Парсим Range заголовок
                byte_start = 0
                byte_end = content_length - 1
                
                range_match = range_header.replace('bytes=', '').split('-')
                if range_match[0]:
                    byte_start = int(range_match[0])
                if range_match[1]:
                    byte_end = int(range_match[1])
                
                # Запрашиваем нужную часть файла
                headers = {'Range': f'bytes={byte_start}-{byte_end}'}
                response = requests.get(direct_link, headers=headers, stream=True)
                
                def generate():
                    try:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                yield chunk
                    except (requests.exceptions.ChunkedEncodingError, requests.exceptions.ConnectionError, Exception) as e:
                        print(f"[YM] Stream error for track {track_id}: {e}")
                        # Не прерываем стриминг, просто логируем ошибку
                        return
                
                response_headers = {
                    'Content-Type': 'audio/mpeg',
                    'Accept-Ranges': 'bytes',
                    'Content-Length': str(byte_end - byte_start + 1),
                    'Content-Range': f'bytes {byte_start}-{byte_end}/{content_length}',
                    'Cache-Control': 'public, max-age=3600'
                }
                
                return Response(generate(), status=206, headers=response_headers)
            except Exception as e:
                print(f"[YM] Range request error: {e}")
        
        # Обычный запрос без Range
        def generate():
            try:
                response = requests.get(direct_link, stream=True)
                response.raise_for_status()
                
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk
            except (requests.exceptions.ChunkedEncodingError, requests.exceptions.ConnectionError, Exception) as e:
                print(f"[YM] Streaming error for track {track_id}: {e}")
                # Не прерываем стриминг, просто логируем ошибку
                return
        
        return Response(
            generate(),
            mimetype='audio/mpeg',
            headers={
                'Content-Type': 'audio/mpeg',
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=3600'
            }
        )
        
    except Exception as e:
        print(f"[YM] Error streaming track: {e}")
        return jsonify({"error": str(e)}), 500

def download_yandex_track(track_id, filename=None):
    """Скачать трек Яндекс.Музыки"""
    try:
        download_info = get_yandex_track_download_info(track_id)
        if not download_info:
            return jsonify({"error": "Track not found or unavailable"}), 404
        
        direct_link = download_info['direct_link']
        
        # Если имя файла не указано, генерируем его
        if not filename:
            filename = f"yandex_music_{track_id}.mp3"
        
        # Скачиваем файл во временную директорию
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_file:
            response = requests.get(direct_link)
            response.raise_for_status()
            
            temp_file.write(response.content)
            temp_file_path = temp_file.name
        
        return send_file(
            temp_file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='audio/mpeg'
        )
        
    except Exception as e:
        print(f"[YM] Error downloading track: {e}")
        return jsonify({"error": str(e)}), 500

def create_rotor_session(seed, reset_used_tracks=False, settings=None):
    """Использовать существующую сессию или создать новую только если ее нет"""
    global YM_ROTOR_SESSION
    
    # Проверяем, нужно ли пересоздать сессию из-за изменения настроек
    current_settings = YM_ROTOR_SESSION.get('current_settings', {})
    settings_changed = settings != current_settings
    
    if settings_changed and YM_ROTOR_SESSION['session_id']:
        print(f"[YM] Settings changed from {current_settings} to {settings}, resetting session")
        # Сбрасываем сессию при изменении настроек
        YM_ROTOR_SESSION['session_id'] = None
        YM_ROTOR_SESSION['batch_id'] = None
        YM_ROTOR_SESSION['last_cursor'] = None
        # Частично очищаем seen_candidates (оставляем последние 200)
        if len(YM_ROTOR_SESSION['seen_candidates']) > 200:
            recent_candidates = list(YM_ROTOR_SESSION['seen_candidates'])[-200:]
            YM_ROTOR_SESSION['seen_candidates'].clear()
            YM_ROTOR_SESSION['seen_candidates'].extend(recent_candidates)
            print("[YM] Partially cleared seen_candidates due to settings change")
    
    # НЕ очищаем used_tracks между запросами в одной сессии для лучшего разнообразия
    # Только при явном перезапуске сессии очищаем seen_candidates частично (оставляем последние 400)
    if reset_used_tracks and len(YM_ROTOR_SESSION['seen_candidates']) > 400:
        # Оставляем только последние 400 треков из seen_candidates
        recent_candidates = list(YM_ROTOR_SESSION['seen_candidates'])[-400:]
        YM_ROTOR_SESSION['seen_candidates'].clear()
        YM_ROTOR_SESSION['seen_candidates'].extend(recent_candidates)
        print("[YM] Partially cleared seen_candidates, kept last 400 entries")
    
    # Если уже есть активная сессия и настройки не изменились - используем её
    if YM_ROTOR_SESSION['session_id'] and not settings_changed:
        print(f"[YM] Using existing rotor session: {YM_ROTOR_SESSION['session_id']}")
        print(f"[YM] Session has {len(YM_ROTOR_SESSION['used_track_ids'])} used tracks")
        if YM_ROTOR_SESSION['last_cursor']:
            print(f"[YM] Session cursor: {YM_ROTOR_SESSION['last_cursor'][:20]}...")
        return True
    
    try:
        import requests
        
        # Получаем токен из клиента
        token = YM_CLIENT.token
        base_url = "https://api.music.yandex.net"
        
        # Заголовки для запросов
        headers = {
            'Authorization': f'OAuth {token}',
            'Content-Type': 'application/json',
            'X-Yandex-Music-Client': 'WindowsPhone/3.20',
            'User-Agent': 'Yandex-Music-API'
        }
        
        # Создаем новую сессию с настройкой на разнообразие
        # Создаем новую сессию роторы с дополнительными параметрами для курсора
        session_settings = {
            'diversity': 'discover'  # Для большего разнообразия
        }
        
        # Применяем пользовательские настройки
        if settings:
            # Настройки настроения
            if settings.get('mood'):
                mood = settings['mood']
                if mood == 'cheerful':
                    session_settings['energy'] = 'high'
                    session_settings['mood'] = 'happy'
                elif mood == 'calm':
                    session_settings['energy'] = 'low' 
                    session_settings['mood'] = 'calm'
                elif mood == 'sad':
                    session_settings['energy'] = 'medium'
                    session_settings['mood'] = 'sad'
                elif mood == 'energetic':
                    session_settings['energy'] = 'high'
                    session_settings['mood'] = 'energetic'
                print(f"[YM] Applied mood setting: {mood}")
            
            # Настройки характера музыки
            if settings.get('character'):
                character = settings['character']
                if character == 'favorite':
                    session_settings['diversity'] = 'favorite'  # Больше знакомого
                elif character == 'unfamiliar':
                    session_settings['diversity'] = 'discover'  # Больше нового
                elif character == 'popular':
                    session_settings['diversity'] = 'popular'   # Популярное
                print(f"[YM] Applied character setting: {character}")
        
        session_payload = {
            'seeds': [seed],
            'includeTracksInResponse': True,
            'settings': session_settings
        }
        
        print(f"[YM] Creating new rotor session with payload: {session_payload}")
        session_response = requests.post(
            f'{base_url}/rotor/session/new',
            headers=headers,
            json=session_payload
        )
        
        if session_response.status_code != 200:
            print(f"[YM] Session creation failed: {session_response.status_code}")
            return False
        
        session_data = session_response.json()
        result_data = session_data.get('result', session_data)
        
        # Извлекаем ID сессии
        radio_session_id = None
        batch_id = None
        
        if 'radioSessionId' in result_data:
            radio_session_id = result_data['radioSessionId']
        elif 'sessionId' in result_data:
            radio_session_id = result_data['sessionId']
        
        if 'batchId' in result_data:
            batch_id = result_data['batchId']
        
        if not radio_session_id:
            print("[YM] No session ID found in response")
            return False
        
        # Сохраняем данные сессии
        YM_ROTOR_SESSION.update({
            'session_id': radio_session_id,
            'batch_id': batch_id,
            'sequence_number': 0,
            'station_seed': seed,
            'last_cursor': None,
            'current_settings': settings or {}
        })
        
        print(f"[YM] New rotor session created: {radio_session_id}")
        
        # Отправляем feedback о начале радио
        send_rotor_feedback('radioStarted', batch_id=batch_id)
        
        return True
        
    except Exception as e:
        print(f"[YM] Error creating rotor session: {e}")
        return False

def create_recommendations_rotor_session(seed):
    """Создать или использовать роторную сессию для рекомендаций с дефолтными настройками"""
    global YM_RECOMMENDATIONS_SESSION
    
    # Если уже есть активная сессия рекомендаций - используем её
    if YM_RECOMMENDATIONS_SESSION['session_id']:
        print(f"[YM] Using existing recommendations rotor session: {YM_RECOMMENDATIONS_SESSION['session_id']}")
        return True
    
    try:
        import requests
        
        # Получаем токен из клиента
        token = YM_CLIENT.token
        base_url = "https://api.music.yandex.net"
        
        # Заголовки для запросов
        headers = {
            'Authorization': f'OAuth {token}',
            'Content-Type': 'application/json',
            'X-Yandex-Music-Client': 'WindowsPhone/3.20',
            'User-Agent': 'Yandex-Music-API'
        }
        
        # Создаем новую сессию рекомендаций с ДЕФОЛТНЫМИ настройками
        session_payload = {
            'seeds': [seed],
            'includeTracksInResponse': True,
            'settings': {
                'diversity': 'default'  # Дефолтные настройки для рекомендаций
            }
        }
        
        print(f"[YM] Creating new recommendations rotor session with default settings")
        session_response = requests.post(
            f'{base_url}/rotor/session/new',
            headers=headers,
            json=session_payload
        )
        
        if session_response.status_code != 200:
            print(f"[YM] Recommendations session creation failed: {session_response.status_code}")
            return False
        
        session_data = session_response.json()
        result_data = session_data.get('result', session_data)
        
        # Извлекаем ID сессии
        radio_session_id = None
        batch_id = None
        
        if 'radioSessionId' in result_data:
            radio_session_id = result_data['radioSessionId']
        elif 'sessionId' in result_data:
            radio_session_id = result_data['sessionId']
        
        if 'batchId' in result_data:
            batch_id = result_data['batchId']
        
        if not radio_session_id:
            print("[YM] No session ID found in recommendations session response")
            return False
        
        # Сохраняем данные сессии рекомендаций
        YM_RECOMMENDATIONS_SESSION.update({
            'session_id': radio_session_id,
            'batch_id': batch_id,
            'sequence_number': 0,
            'station_seed': seed,
            'last_cursor': None
        })
        
        print(f"[YM] New recommendations rotor session created: {radio_session_id}")
        return True
        
    except Exception as e:
        print(f"[YM] Error creating recommendations rotor session: {e}")
        return False

def send_rotor_feedback(event_type, track_id=None, batch_id=None, played_seconds=None, track_duration=None):
    """Отправить feedback в роторную сессию"""
    try:
        if not YM_ROTOR_SESSION['session_id']:
            return False
        
        import requests
        from datetime import datetime
        
        token = YM_CLIENT.token
        base_url = "https://api.music.yandex.net"
        
        headers = {
            'Authorization': f'OAuth {token}',
            'Content-Type': 'application/json',
            'X-Yandex-Music-Client': 'WindowsPhone/3.20',
            'User-Agent': 'Yandex-Music-API'
        }
        
        event_data = {
            'type': event_type,
            'timestamp': datetime.now().astimezone().strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + '+03:00'
        }
        
        if event_type == 'radioStarted':
            station_seed = YM_ROTOR_SESSION['station_seed']
            if ':' in station_seed:
                station_type, station_tag = station_seed.split(':', 1)
                event_data['from'] = f'radio-mobile-{station_type}-{station_tag}-default'
        elif track_id:
            # Убеждаемся что ID трека в правильном формате
            if ':' in track_id:
                event_data['trackId'] = track_id  # Уже в формате "id:albumId"
            else:
                event_data['trackId'] = track_id
            
            # Для trackFinished нужен корректный totalPlayedSeconds
            if event_type == 'trackFinished':
                if played_seconds is not None and track_duration is not None:
                    # Используем фактическое время проигрывания
                    event_data['totalPlayedSeconds'] = min(played_seconds, track_duration)
                elif track_duration is not None:
                    # Если не передано время, считаем что дослушали 80% трека
                    event_data['totalPlayedSeconds'] = track_duration * 0.8
                else:
                    # Фолбэк: средняя продолжительность трека
                    event_data['totalPlayedSeconds'] = 180.0
        
        feedback_data = {
            'event': event_data,
            'sequenceNumber': YM_ROTOR_SESSION['sequence_number']
        }
        
        if batch_id:
            feedback_data['batchId'] = batch_id
        elif YM_ROTOR_SESSION['batch_id']:
            feedback_data['batchId'] = YM_ROTOR_SESSION['batch_id']
        
        feedback_response = requests.post(
            f'{base_url}/rotor/session/{YM_ROTOR_SESSION["session_id"]}/feedback',
            headers=headers,
            json=feedback_data
        )
        
        if feedback_response.status_code == 200:
            # Обновляем время последнего успешного feedback
            YM_ROTOR_SESSION['last_feedback_time'] = time.time()
            YM_ROTOR_SESSION['can_request_more'] = True  # После успешного feedback можно запрашивать треки
            if event_type == 'trackFinished' and played_seconds is not None:
                print(f"[YM] Feedback sent: {event_type} for track {track_id}, played {played_seconds:.1f}s")
            else:
                print(f"[YM] Feedback sent: {event_type}" + (f" for track {track_id}" if track_id else ""))
            return True
        else:
            print(f"[YM] Feedback failed: {feedback_response.status_code}, response: {feedback_response.text}")
            return False
            
    except Exception as e:
        print(f"[YM] Error sending feedback: {e}")
        return False

def get_next_rotor_tracks(count=5):
    """Получить следующие треки из роторной сессии - НИКОГДА не сбрасывает курсор"""
    try:
        if not YM_ROTOR_SESSION['session_id']:
            print("[YM] No active rotor session")
            return []
        
        import requests
        
        token = YM_CLIENT.token
        base_url = "https://api.music.yandex.net"
        
        headers = {
            'Authorization': f'OAuth {token}',
            'Content-Type': 'application/json',
            'X-Yandex-Music-Client': 'WindowsPhone/3.20',
            'User-Agent': 'Yandex-Music-API'
        }
        
        # ВСЕГДА используем текущий курсор и batchId, никогда не сбрасываем
        request_data = {
            'includeTracksInResponse': True
        }
        
        # Добавляем batchId если есть
        if YM_ROTOR_SESSION['batch_id']:
            request_data['batchId'] = YM_ROTOR_SESSION['batch_id']
        
        if YM_ROTOR_SESSION['last_cursor']:
            request_data['cursor'] = YM_ROTOR_SESSION['last_cursor']
            print(f"[YM] Using cursor")
        else:
            print("[YM] No cursor (first batch)")
        
        tracks_response = requests.post(
            f'{base_url}/rotor/session/{YM_ROTOR_SESSION["session_id"]}/tracks',
            headers=headers,
            json=request_data
        )
        
        if tracks_response.status_code != 200:
            print(f"[YM] Failed to get tracks: {tracks_response.status_code} - {tracks_response.text}")
            return []
        
        tracks_data = tracks_response.json()
        result_data = tracks_data.get('result', tracks_data)
        sequence = result_data.get('sequence', [])
        
        # ВСЕГДА сохраняем новый курсор если он есть
        if 'cursor' in result_data:
            YM_ROTOR_SESSION['last_cursor'] = result_data['cursor']
            print(f"[YM] Got new cursor")
        else:
            print(f"[YM] No cursor in response")
            # Проверяем pumpkin для альтернативного курсора
            if 'pumpkin' in result_data and isinstance(result_data['pumpkin'], dict):
                if 'cursor' in result_data['pumpkin']:
                    YM_ROTOR_SESSION['last_cursor'] = result_data['pumpkin']['cursor']
                    print(f"[YM] Found cursor in pumpkin")
        
        # Обновляем batchId если есть
        if 'batchId' in result_data:
            YM_ROTOR_SESSION['batch_id'] = result_data['batchId']
            print(f"[YM] Got new batchId")
        
        # Обрабатываем все треки но НЕ добавляем в seen_candidates автоматически
        all_tracks = []
        for item in sequence:
            track = None
            if hasattr(item, 'track') and item.track:
                track = item.track
            elif isinstance(item, dict) and 'track' in item:
                track_data = item['track']
                class TrackStub:
                    def __init__(self, data):
                        for key, value in data.items():
                            setattr(self, key, value)
                track = TrackStub(track_data)
            
            if track and hasattr(track, 'id'):
                all_tracks.append(track)
        
        print(f"[YM] Rotor returned {len(all_tracks)} tracks from sequence")
        YM_ROTOR_SESSION['sequence_number'] += 1
        
        # Если курсора нет, отправляем feedback чтобы "разбудить" роторную систему
        if not YM_ROTOR_SESSION['last_cursor'] and all_tracks:
            first_track = all_tracks[0]
            if hasattr(first_track, 'id'):
                print(f"[YM] No cursor received, sending trackStarted feedback to wake up rotor")
                send_rotor_feedback('trackStarted', str(first_track.id))
        
        return all_tracks[:count]
        
    except Exception as e:
        print(f"[YM] Error getting next rotor tracks: {e}")
        return []

def get_recommendations_tracks(count=10):
    """Получить треки для рекомендаций из отдельной роторной сессии"""
    try:
        if not YM_RECOMMENDATIONS_SESSION['session_id']:
            print("[YM] No active recommendations rotor session")
            return []
        
        import requests
        
        token = YM_CLIENT.token
        base_url = "https://api.music.yandex.net"
        
        headers = {
            'Authorization': f'OAuth {token}',
            'Content-Type': 'application/json',
            'X-Yandex-Music-Client': 'WindowsPhone/3.20',
            'User-Agent': 'Yandex-Music-API'
        }
        
        # Формируем запрос для получения треков рекомендаций
        request_data = {
            'includeTracksInResponse': True
        }
        
        # Добавляем batchId если есть
        if YM_RECOMMENDATIONS_SESSION['batch_id']:
            request_data['batchId'] = YM_RECOMMENDATIONS_SESSION['batch_id']
        
        if YM_RECOMMENDATIONS_SESSION['last_cursor']:
            request_data['cursor'] = YM_RECOMMENDATIONS_SESSION['last_cursor']
            print(f"[YM] Using recommendations cursor")
        else:
            print("[YM] No recommendations cursor (first batch)")
        
        tracks_response = requests.post(
            f'{base_url}/rotor/session/{YM_RECOMMENDATIONS_SESSION["session_id"]}/tracks',
            headers=headers,
            json=request_data
        )
        
        if tracks_response.status_code != 200:
            print(f"[YM] Failed to get recommendations tracks: {tracks_response.status_code} - {tracks_response.text}")
            return []
        
        tracks_data = tracks_response.json()
        result_data = tracks_data.get('result', tracks_data)
        sequence = result_data.get('sequence', [])
        
        # Сохраняем новый курсор если есть
        if 'cursor' in result_data:
            YM_RECOMMENDATIONS_SESSION['last_cursor'] = result_data['cursor']
            print(f"[YM] Got new recommendations cursor")
        
        # Обновляем batchId если есть
        if 'batchId' in result_data:
            YM_RECOMMENDATIONS_SESSION['batch_id'] = result_data['batchId']
            print(f"[YM] Got new recommendations batchId")
        
        # Обрабатываем все треки
        all_tracks = []
        for item in sequence:
            track = None
            if hasattr(item, 'track') and item.track:
                track = item.track
            elif isinstance(item, dict) and 'track' in item:
                track_data = item['track']
                class TrackStub:
                    def __init__(self, data):
                        for key, value in data.items():
                            setattr(self, key, value)
                track = TrackStub(track_data)
            
            if track and hasattr(track, 'id'):
                all_tracks.append(track)
        
        print(f"[YM] Recommendations returned {len(all_tracks)} tracks from sequence")
        YM_RECOMMENDATIONS_SESSION['sequence_number'] += 1
        
        return all_tracks[:count]
        
    except Exception as e:
        print(f"[YM] Error getting recommendations tracks: {e}")
        return []

def get_yandex_track_info(track_id):
    """Получить детальную информацию о треке"""
    if not YM_CLIENT:
        return None
    
    try:
        if ':' in track_id:
            actual_track_id, album_id = track_id.split(':', 1)
        else:
            actual_track_id = track_id
        
        tracks = YM_CLIENT.tracks([actual_track_id])
        if not tracks or len(tracks) == 0:
            return None
        
        track = tracks[0]
        return format_yandex_track(track)
        
    except Exception as e:
        print(f"[YM] Error getting track info: {e}")
        return None

def setup_yandex_music_routes(app, settings_file):
    """Настроить маршруты для Яндекс.Музыки"""
    print("[YM] Setting up Yandex Music routes...")
    global YM_SETTINGS_FILE
    YM_SETTINGS_FILE = settings_file
    
    # Попытка автоматической инициализации клиента при запуске
    token = get_yandex_music_token(settings_file)
    if token:
        initialize_yandex_client(token)
    
    @app.route('/api/yandex-music/auth-status', methods=['GET'])
    def yandex_auth_status():
        try:
            token = get_yandex_music_token(YM_SETTINGS_FILE)
            if not token:
                return jsonify({
                    "authenticated": False,
                    "message": "No token found"
                })
            
            # Проверяем валидность токена
            global YM_CLIENT
            if not YM_CLIENT:
                success = initialize_yandex_client(token)
                if not success:
                    return jsonify({
                        "authenticated": False,
                        "message": "Invalid token"
                    })
            
            try:
                account = YM_CLIENT.account_status()
                return jsonify({
                    "authenticated": True,
                    "account": {
                        "uid": account.account.uid,
                        "login": account.account.login,
                        "display_name": account.account.display_name
                    }
                })
            except:
                return jsonify({
                    "authenticated": False,
                    "message": "Token expired or invalid"
                })
                
        except Exception as e:
            return jsonify({
                "authenticated": False,
                "error": str(e)
            }), 500
    
    @app.route('/api/yandex-music/login', methods=['POST'])
    def yandex_login():
        try:
            data = request.json or {}
            token = data.get('token', '').strip()
            
            if not token:
                return jsonify({
                    'success': False,
                    'error': 'Token is required'
                }), 400
            
            # Попытка инициализации клиента с новым токеном
            if initialize_yandex_client(token):
                # Сохраняем токен
                if save_yandex_music_token(token, YM_SETTINGS_FILE):
                    account = YM_CLIENT.account_status()
                    return jsonify({
                        'success': True,
                        'message': 'Authentication successful',
                        'account': {
                            'uid': account.account.uid,
                            'login': account.account.login,
                            'display_name': account.account.display_name
                        }
                    })
                else:
                    return jsonify({
                        'success': False,
                        'error': 'Failed to save token'
                    }), 500
            else:
                return jsonify({
                    'success': False,
                    'error': 'Invalid token'
                }), 400
                
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    @app.route('/api/yandex-music/logout', methods=['POST'])
    def yandex_logout():
        try:
            global YM_CLIENT
            YM_CLIENT = None
            
            if os.path.exists(YM_SETTINGS_FILE):
                os.remove(YM_SETTINGS_FILE)
            
            return jsonify({
                "success": True,
                "message": "Logged out successfully"
            })
        except Exception as e:
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500
    
    @app.route('/api/yandex-music/search', methods=['GET'])
    def yandex_search():
        query = request.args.get('query', '').strip()
        if not query:
            return jsonify({"error": "Query parameter is required"}), 400
        
        results = search_yandex_music(query)
        return jsonify(results)
    
    @app.route('/api/yandex-music/stream', methods=['GET'])
    def yandex_stream():
        track_id = request.args.get('id', '').strip()
        if not track_id:
            return jsonify({"error": "Track ID is required"}), 400
        
        return stream_yandex_track(track_id)
    
    @app.route('/api/yandex-music/download', methods=['GET'])
    def yandex_download():
        track_id = request.args.get('id', '').strip()
        if not track_id:
            return jsonify({"error": "Track ID is required"}), 400
        
        filename = request.args.get('filename')
        return download_yandex_track(track_id, filename)
    
    @app.route('/api/yandex-music/track-info', methods=['GET'])
    def yandex_track_info():
        track_id = request.args.get('id', '').strip()
        if not track_id:
            return jsonify({"error": "Track ID is required"}), 400
        
        track_info = get_yandex_track_info(track_id)
        if track_info:
            return jsonify(track_info)
        else:
            return jsonify({"error": "Track not found"}), 404
    
    @app.route('/api/yandex-music/playlists', methods=['GET'])
    def yandex_playlists():
        try:
            if not YM_CLIENT:
                return jsonify({"error": "Not authenticated"}), 401
            
            playlists = get_yandex_playlists()
            return jsonify(playlists)
            
        except Exception as e:
            print(f"[YM] Error in playlists endpoint: {e}")
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/yandex-music/liked-tracks', methods=['GET'])
    def yandex_liked_tracks():
        try:
            if not YM_CLIENT:
                return jsonify({"error": "Not authenticated"}), 401
            
            tracks = get_yandex_liked_tracks()
            return jsonify(tracks)
            
        except Exception as e:
            print(f"[YM] Error in liked tracks endpoint: {e}")
            return jsonify({"error": str(e)}), 500
    
    # Роут для очистки истории волны
    @app.route('/api/yandex-music/wave/clear-history', methods=['POST'])
    def clear_wave_history():
        """Очистить историю прослушанных треков волны"""
        try:
            YM_ROTOR_SESSION['used_track_ids'].clear()
            YM_ROTOR_SESSION['seen_candidates'].clear()
            YM_ROTOR_SESSION['last_unique_count_history'].clear()
            YM_ROTOR_SESSION['consecutive_empty_requests'] = 0
            
            print(f"[YM] Wave history cleared: used_tracks={len(YM_ROTOR_SESSION['used_track_ids'])}, seen_candidates={len(YM_ROTOR_SESSION['seen_candidates'])}")
            
            return jsonify({
                "success": True,
                "message": "История прослушивания очищена"
            })
        except Exception as e:
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500
    
    # Роуты для "Моя волна" - запуск волны
    @app.route('/api/yandex-music/wave/start', methods=['GET'])
    def start_wave():
        """Запустить новую волну для воспроизведения"""
        try:
            if not YM_CLIENT:
                return jsonify({
                    "success": False,
                    "error": "Необходима авторизация в Яндекс.Музыке"
                }), 401
            
            # Получаем параметры настроек из query string
            mood = request.args.get('mood')  # cheerful, calm, sad, energetic
            character = request.args.get('character')  # favorite, unfamiliar, popular
            
            settings = {}
            if mood:
                settings['mood'] = mood
            if character:
                settings['character'] = character
            
            print(f"[YM] Starting wave with settings: {settings}")
            
            # Получаем список станций
            rotor = YM_CLIENT.rotor_stations_dashboard()
            personal_station = None
            
            print(f"[YM] Found {len(rotor.stations)} stations")
            
            # Ищем персональную станцию (Моя волна)
            for station in rotor.stations:
                if hasattr(station, 'station') and station.station:
                    station_obj = station.station
                    
                    if hasattr(station_obj, 'id') and station_obj.id:
                        station_id = station_obj.id
                        
                        # Проверяем разные варианты персональной станции
                        if (hasattr(station_id, 'type') and 
                            (station_id.type == 'personal' or 
                             station_id.type == 'user' or
                             (hasattr(station_id, 'tag') and 'personal' in str(station_id.tag).lower()))):
                            personal_station = station_obj
                            print(f"[YM] Found personal station: {station_obj.name}")
                            break
            
            # Если не нашли по типу, попробуем найти по названию
            if not personal_station:
                print("[YM] Trying to find station by name...")
                for station in rotor.stations:
                    if hasattr(station, 'station') and station.station:
                        station_obj = station.station
                        station_name = getattr(station_obj, 'name', '').lower()
                        if 'волна' in station_name or 'personal' in station_name or 'моя' in station_name:
                            personal_station = station_obj
                            print(f"[YM] Found personal station by name: {station_obj.name}")
                            break
            
            if not personal_station:
                return jsonify({
                    "success": False,
                    "error": "Персональная станция (Моя волна) не найдена"
                }), 404
            
            # Создаем seed для станции
            station_id = personal_station.id
            seed = f"{station_id.type}:{station_id.tag}"
            print(f"[YM] Using seed: {seed}")
            
            # Создаем или используем существующую роторную сессию
            # НИКОГДА не сбрасываем used_tracks, только создаем сессию если ее еще нет
            if not create_rotor_session(seed, reset_used_tracks=False, settings=settings):
                return jsonify({
                    "success": False,
                    "error": "Не удалось создать роторную сессию"
                }), 500
            
            # Получаем первые треки из сессии
            raw_tracks = get_next_rotor_tracks(count=10)
            if not raw_tracks:
                print("[YM] Wave start failed - no tracks from rotor session")
                return jsonify({
                    "success": False,
                    "error": "Не удалось получить треки из волны"
                }), 500

            # Фильтруем дубликаты и добавляем в глобальный список
            unique_raw_tracks = []
            for track in raw_tracks:
                if hasattr(track, 'id'):
                    track_id = str(track.id)
                    if track_id not in YM_ROTOR_SESSION['used_track_ids']:
                        unique_raw_tracks.append(track)
                        YM_ROTOR_SESSION['used_track_ids'].add(track_id)
                        # ДОБАВЛЯЕМ в seen_candidates только когда трек РЕАЛЬНО используется
                        YM_ROTOR_SESSION['seen_candidates'].append(track_id)
                    else:
                        print(f"[YM] Wave start - filtered duplicate track ID: {track_id}")

            if not unique_raw_tracks:
                print("[YM] Wave start failed - all tracks were duplicates")
                # Не возвращаем ошибку, просто берем raw_tracks как есть
                unique_raw_tracks = raw_tracks
            
            # Получаем полную информацию о треках
            track_ids = []
            for track in unique_raw_tracks:
                try:
                    if hasattr(track, 'albums') and track.albums and len(track.albums) > 0:
                        first_album = track.albums[0]
                        if hasattr(first_album, 'id'):
                            album_id = first_album.id
                        elif isinstance(first_album, dict) and 'id' in first_album:
                            album_id = first_album['id']
                        else:
                            album_id = str(first_album)
                        track_ids.append(f"{track.id}:{album_id}")
                    else:
                        track_ids.append(str(track.id))
                except Exception:
                    track_ids.append(str(track.id))
            
            # Получаем детальную информацию о треках
            formatted_tracks = []
            if track_ids:
                tracks_info = YM_CLIENT.tracks(track_ids)
                
                for track in tracks_info:
                    if track:
                        # Получаем обложку
                        thumbnail = None
                        if track.cover_uri:
                            thumbnail = f"https://{track.cover_uri.replace('%%', '400x400')}"
                        elif track.albums and track.albums[0].cover_uri:
                            thumbnail = f"https://{track.albums[0].cover_uri.replace('%%', '400x400')}"
                        
                        # Формируем исполнителей
                        artists = [artist.name for artist in track.artists] if track.artists else []
                        
                        formatted_track = {
                            "id": str(track.id),
                            "title": track.title or "Unknown Title",
                            "artist": ", ".join(artists) if artists else "Unknown Artist",
                            "uploader": ", ".join(artists) if artists else "Unknown Artist",
                            "duration": track.duration_ms // 1000 if track.duration_ms else 0,
                            "thumbnail": thumbnail,
                            "platform": "yandex_music",
                            "url": f"yandex_music:{track.id}",
                            "feedback": None
                        }
                        
                        formatted_tracks.append(formatted_track)
            
            print(f"[YM] Successfully loaded {len(formatted_tracks)} unique tracks for wave start")
            
            return jsonify({
                "success": True,
                "tracks": formatted_tracks,
                "stationInfo": {
                    "name": personal_station.name,
                    "id": str(personal_station.id)
                }
            })
            
        except UnauthorizedError:
            return jsonify({
                "success": False,
                "error": "Токен авторизации недействителен. Пожалуйста, войдите заново."
            }), 401
        except Exception as e:
            print(f"[YM] Error starting wave: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                "success": False,
                "error": f"Ошибка запуска волны: {str(e)}"
            }), 500
    
    @app.route('/api/yandex-music/recommendations', methods=['GET'])
    def get_recommendations():
        """Получить рекомендации для просмотра (отдельно от волны, с дефолтными настройками)"""
        try:
            if not YM_CLIENT:
                return jsonify({
                    "success": False,
                    "error": "Необходима авторизация в Яндекс.Музыке"
                }), 401
            
            print("[YM] Getting recommendations with default settings (separate from wave)")
            
            # Получаем список станций
            rotor = YM_CLIENT.rotor_stations_dashboard()
            personal_station = None
            
            print(f"[YM] Found {len(rotor.stations)} stations")
            
            # Ищем персональную станцию (Моя волна)
            for station in rotor.stations:
                if hasattr(station, 'station') and station.station:
                    station_obj = station.station
                    
                    if hasattr(station_obj, 'id') and station_obj.id:
                        station_id = station_obj.id
                        
                        # Проверяем разные варианты персональной станции
                        if (hasattr(station_id, 'type') and 
                            (station_id.type == 'personal' or 
                             station_id.type == 'user' or
                             (hasattr(station_id, 'tag') and 'personal' in str(station_id.tag).lower()))):
                            personal_station = station_obj
                            print(f"[YM] Found personal station: {station_obj.name}")
                            break
            
            # Если не нашли по типу, попробуем найти по названию
            if not personal_station:
                print("[YM] Trying to find station by name...")
                for station in rotor.stations:
                    if hasattr(station, 'station') and station.station:
                        station_obj = station.station
                        station_name = getattr(station_obj, 'name', '').lower()
                        if 'волна' in station_name or 'personal' in station_name or 'моя' in station_name:
                            personal_station = station_obj
                            print(f"[YM] Found personal station by name: {station_obj.name}")
                            break
            
            if not personal_station:
                return jsonify({
                    "success": False,
                    "error": "Персональная станция (Моя волна) не найдена"
                }), 404
            
            # Используем ОТДЕЛЬНУЮ роторную сессию для рекомендаций
            station_id = personal_station.id
            seed = f"{station_id.type}:{station_id.tag}"
            print(f"[YM] Using seed for recommendations: {seed}")
            
            # Создаем отдельную сессию рекомендаций с дефолтными настройками
            if not create_recommendations_rotor_session(seed):
                return jsonify({
                    "success": False,
                    "error": "Не удалось создать роторную сессию для рекомендаций"
                }), 500
            
            # Получаем треки из ОТДЕЛЬНОЙ роторной сессии рекомендаций
            try:
                sequence_tracks = get_recommendations_tracks(count=10)
                if not sequence_tracks:
                    return jsonify({
                        "success": False,
                        "error": "Не удалось получить треки для рекомендаций"
                    }), 500
                
                print(f"[YM] Got {len(sequence_tracks)} tracks in recommendations")
                
            except Exception as error:
                print(f"[YM] Error getting recommendation tracks: {error}")
                return jsonify({
                    "success": False,
                    "error": f"Не удалось получить рекомендации: {str(error)}"
                })
            
            # Преобразуем треки в наш формат
            formatted_tracks = []
            track_ids = []
            
            for track in sequence_tracks:
                if track and hasattr(track, 'id'):
                    try:
                        if hasattr(track, 'albums') and track.albums and len(track.albums) > 0:
                            first_album = track.albums[0]
                            if hasattr(first_album, 'id'):
                                album_id = first_album.id
                            elif isinstance(first_album, dict) and 'id' in first_album:
                                album_id = first_album['id']
                            else:
                                album_id = str(first_album)
                            track_ids.append(f"{track.id}:{album_id}")
                        else:
                            track_ids.append(str(track.id))
                    except Exception:
                        track_ids.append(str(track.id))
            
            # Получаем дополнительную информацию о треках
            if track_ids:
                tracks_info = YM_CLIENT.tracks(track_ids)
                
                for track in tracks_info:
                    if track:
                        # Получаем обложку
                        thumbnail = None
                        if track.cover_uri:
                            thumbnail = f"https://{track.cover_uri.replace('%%', '400x400')}"
                        elif track.albums and track.albums[0].cover_uri:
                            thumbnail = f"https://{track.albums[0].cover_uri.replace('%%', '400x400')}"
                        
                        # Формируем исполнителей
                        artists = [artist.name for artist in track.artists] if track.artists else []
                        
                        formatted_track = {
                            "id": str(track.id),
                            "title": track.title or "Unknown Title",
                            "artist": ", ".join(artists) if artists else "Unknown Artist",
                            "uploader": ", ".join(artists) if artists else "Unknown Artist",
                            "duration": track.duration_ms // 1000 if track.duration_ms else 0,
                            "thumbnail": thumbnail,
                            "platform": "yandex_music",
                            "url": f"yandex_music:{track.id}",
                            "feedback": None
                        }
                        
                        formatted_tracks.append(formatted_track)
            
            print(f"[YM] Formatted {len(formatted_tracks)} recommendation tracks")
            
            return jsonify({
                "success": True,
                "tracks": formatted_tracks,
                "stationInfo": {
                    "name": personal_station.name,
                    "id": str(personal_station.id)
                }
            })
            
        except UnauthorizedError:
            return jsonify({
                "success": False,
                "error": "Токен авторизации недействителен. Пожалуйста, войдите заново."
            }), 401
        except Exception as e:
            print(f"[YM] Error getting recommendations: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                "success": False,
                "error": f"Ошибка получения рекомендаций: {str(e)}"
            }), 500
    
    @app.route('/api/yandex-music/wave/next', methods=['POST'])
    def get_next_wave_tracks():
        """Получить следующие треки для волны"""
        try:
            if not YM_CLIENT:
                return jsonify({
                    "success": False,
                    "error": "Необходима авторизация в Яндекс.Музыке"
                }), 401

            data = request.get_json() or {}
            count = data.get('count', 5)  # По умолчанию загружаем 5 треков
            used_track_ids = data.get('usedTrackIds', [])  # Уже используемые треки

            print(f"[YM] Loading next {count} wave tracks using rotor session...")
            
            # Обновляем глобальный список используемых треков
            YM_ROTOR_SESSION['used_track_ids'].update(used_track_ids)
            print(f"[YM] Updated global used tracks: {len(YM_ROTOR_SESSION['used_track_ids'])} total")

            # Если у нас нет курсора, добавляем небольшую задержку перед запросом
            if not YM_ROTOR_SESSION['last_cursor']:
                import time
                time.sleep(0.5)  # Пауза 0.5 сек если нет курсора

            # Получаем следующие треки из роторной сессии (БЕЗ фильтрации дубликатов в get_next_rotor_tracks)
            raw_tracks = get_next_rotor_tracks(count * 2)  # Запрашиваем больше треков для фильтрации
            if not raw_tracks:
                print(f"[YM] No more tracks available from rotor session")
                return jsonify({
                    "success": True,
                    "tracks": [],
                    "message": "Новых треков пока нет, попробуйте позже"
                })

            # Фильтруем дубликаты используя только used_track_ids (реально проигранные треки)
            unique_raw_tracks = []
            seen_candidates_list = list(YM_ROTOR_SESSION['seen_candidates'])
            
            for track in raw_tracks:
                if hasattr(track, 'id'):
                    track_id = str(track.id)
                    # Приоритетная фильтрация: только по used_track_ids (реально проигранные)
                    if track_id not in YM_ROTOR_SESSION['used_track_ids']:
                        # Вторичная фильтрация: по seen_candidates только при переполнении
                        if len(YM_ROTOR_SESSION['seen_candidates']) < 800 or track_id not in seen_candidates_list:
                            unique_raw_tracks.append(track)
                            YM_ROTOR_SESSION['used_track_ids'].add(track_id)
                            # ДОБАВЛЯЕМ в seen_candidates только когда трек РЕАЛЬНО используется
                            YM_ROTOR_SESSION['seen_candidates'].append(track_id)
                            if len(unique_raw_tracks) >= count:
                                break  # Как только набрали нужное количество, останавливаемся
                        else:
                            print(f"[YM] Filtered seen candidate track ID: {track_id}")
                    else:
                        print(f"[YM] Filtered duplicate track ID: {track_id}")
            
            # Если после строгой фильтрации получили мало треков, ослабляем фильтр
            if len(unique_raw_tracks) < count // 2:
                print(f"[YM] Got only {len(unique_raw_tracks)} after strict filtering, relaxing filter...")
                for track in raw_tracks:
                    if hasattr(track, 'id') and len(unique_raw_tracks) < count:
                        track_id = str(track.id)
                        # Ослабленная фильтрация: только по used_track_ids
                        if track_id not in YM_ROTOR_SESSION['used_track_ids']:
                            if track not in unique_raw_tracks:
                                unique_raw_tracks.append(track)
                                YM_ROTOR_SESSION['used_track_ids'].add(track_id)
                                # ДОБАВЛЯЕМ в seen_candidates только когда трек РЕАЛЬНО используется
                                YM_ROTOR_SESSION['seen_candidates'].append(track_id)

            # Обновляем историю количества уникальных треков
            unique_count = len(unique_raw_tracks)
            YM_ROTOR_SESSION['last_unique_count_history'].append(unique_count)
            print(f"[YM] Unique tracks history: {list(YM_ROTOR_SESSION['last_unique_count_history'])}")

            if not unique_raw_tracks:
                YM_ROTOR_SESSION['consecutive_empty_requests'] += 1
                print(f"[YM] All tracks from rotor were duplicates (consecutive empty: {YM_ROTOR_SESSION['consecutive_empty_requests']})")
                return jsonify({
                    "success": True,
                    "tracks": [],
                    "message": "Все новые треки уже были в плейлисте"
                })
            else:
                YM_ROTOR_SESSION['consecutive_empty_requests'] = 0

            # Получаем полную информацию о уникальных треках
            track_ids = []
            for track in unique_raw_tracks:
                try:
                    if hasattr(track, 'albums') and track.albums and len(track.albums) > 0:
                        first_album = track.albums[0]
                        if hasattr(first_album, 'id'):
                            album_id = first_album.id
                        elif isinstance(first_album, dict) and 'id' in first_album:
                            album_id = first_album['id']
                        else:
                            album_id = str(first_album)
                        track_ids.append(f"{track.id}:{album_id}")
                    else:
                        track_ids.append(str(track.id))
                except Exception:
                    track_ids.append(str(track.id))

            # Получаем детальную информацию о треках
            formatted_tracks = []
            if track_ids:
                tracks_info = YM_CLIENT.tracks(track_ids)
                
                for track in tracks_info:
                    if track:
                        # Получаем обложку
                        thumbnail = None
                        if track.cover_uri:
                            thumbnail = f"https://{track.cover_uri.replace('%%', '400x400')}"
                        elif track.albums and track.albums[0].cover_uri:
                            thumbnail = f"https://{track.albums[0].cover_uri.replace('%%', '400x400')}"
                        
                        # Формируем исполнителей
                        artists = [artist.name for artist in track.artists] if track.artists else []
                        
                        formatted_track = {
                            "id": str(track.id),
                            "title": track.title or "Unknown Title",
                            "artist": ", ".join(artists) if artists else "Unknown Artist",
                            "uploader": ", ".join(artists) if artists else "Unknown Artist",
                            "duration": track.duration_ms // 1000 if track.duration_ms else 0,
                            "thumbnail": thumbnail,
                            "platform": "yandex_music",
                            "url": f"yandex_music:{track.id}",
                            "feedback": None
                        }
                        
                        formatted_tracks.append(formatted_track)

            print(f"[YM] Successfully loaded {len(formatted_tracks)} unique new wave tracks using persistent session")

            # Защита от застревания: проверяем историю уникальных треков
            history = list(YM_ROTOR_SESSION['last_unique_count_history'])
            if len(history) >= 4:
                total_unique = sum(history)
                print(f"[YM] Last 4 requests unique counts: {history}, total: {total_unique}")
                
                # Если за последние 4 запроса получили меньше 4 уникальных треков - жесткая проблема
                if total_unique < 4:
                    print(f"[YM] CRITICAL: Very low unique track yield ({total_unique} in last 4 requests)")
                    
                    # Частично очищаем seen_candidates (оставляем только последние 200)
                    if len(YM_ROTOR_SESSION['seen_candidates']) > 200:
                        recent_candidates = list(YM_ROTOR_SESSION['seen_candidates'])[-200:]
                        YM_ROTOR_SESSION['seen_candidates'].clear()
                        YM_ROTOR_SESSION['seen_candidates'].extend(recent_candidates)
                        print(f"[YM] Emergency cleanup: kept only last {len(recent_candidates)} seen_candidates")
                    
                    # Очищаем историю для нового начала
                    YM_ROTOR_SESSION['last_unique_count_history'].clear()

            return jsonify({
                "success": True,
                "tracks": formatted_tracks
            })
                
        except Exception as e:
            print(f"[YM] Error in next wave tracks: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                "success": False,
                "error": f"Ошибка загрузки треков: {str(e)}"
            }), 500

    @app.route('/api/yandex-music/wave/feedback', methods=['POST'])
    def wave_feedback():
        """Отправить фидбек для трека из волны"""
        try:
            if not YM_CLIENT:
                return jsonify({
                    "success": False,
                    "error": "Необходима авторизация в Яндекс.Музыке"
                }), 401
            
            data = request.get_json()
            if not data:
                return jsonify({"success": False, "error": "No data provided"}), 400
            
            track_id = data.get('trackId')
            feedback_type = data.get('type')  # 'trackStarted', 'trackFinished', 'like', 'dislike', 'skip'
            played_seconds = data.get('playedSeconds')  # Фактическое время проигрывания
            track_duration = data.get('trackDuration')  # Общая длительность трека
            
            if not track_id or not feedback_type:
                return jsonify({
                    "success": False,
                    "error": "trackId и type обязательны"
                }), 400
            
            print(f"[YM] Sending rotor feedback: {feedback_type} for track {track_id}")
            
            # Используем новую систему feedback для роторной сессии
            if feedback_type in ['trackStarted', 'trackFinished']:
                success = send_rotor_feedback(feedback_type, track_id, played_seconds=played_seconds, track_duration=track_duration)
                if success:
                    print(f"[YM] Rotor feedback sent: {feedback_type} for track {track_id}")
                else:
                    print(f"[YM] Failed to send rotor feedback: {feedback_type} for track {track_id}")
            
            # Дополнительные действия для конкретных типов feedback
            if feedback_type == 'like':
                # Добавляем в лайки
                try:
                    YM_CLIENT.users_likes_tracks_add(track_id)
                    print(f"[YM] Added track {track_id} to likes")
                except Exception as e:
                    print(f"[YM] Error adding to likes: {e}")
                
            elif feedback_type == 'dislike':
                # Убираем из лайков (если был)
                try:
                    YM_CLIENT.users_likes_tracks_remove(track_id)
                except:
                    pass  # Возможно, трек не был в лайках
                print(f"[YM] Processed dislike for track {track_id}")
                
            elif feedback_type == 'skip':
                # Отправляем feedback о пропуске в роторную сессию с минимальным временем
                send_rotor_feedback('trackFinished', track_id, played_seconds=played_seconds or 5.0, track_duration=track_duration)
                print(f"[YM] Processed skip for track {track_id}")
            
            return jsonify({"success": True})
            
        except UnauthorizedError:
            return jsonify({
                "success": False,
                "error": "Токен авторизации недействителен"
            }), 401
        except Exception as e:
            print(f"[YM] Error sending wave feedback: {e}")
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500
    
    print("[YM] Yandex Music routes setup completed")
    return app

def get_tracks_by_ids_batch(track_ids, batch_size=250):
    """Получить полную информацию о треках по их ID батчами"""
    if not YM_CLIENT or not track_ids:
        return []
    
    all_tracks = []
    total_batches = (len(track_ids) + batch_size - 1) // batch_size
    
    print(f"[YM] Loading {len(track_ids)} tracks in {total_batches} batches of {batch_size}")
    
    for i in range(0, len(track_ids), batch_size):
        batch_ids = track_ids[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        
        try:
            print(f"[YM] Loading batch {batch_num}/{total_batches} ({len(batch_ids)} tracks)")
            tracks = YM_CLIENT.tracks(batch_ids)
            
            if tracks:
                formatted_tracks = []
                for track in tracks:
                    try:
                        formatted_track = format_yandex_track(track)
                        if formatted_track:
                            formatted_tracks.append(formatted_track)
                    except Exception as e:
                        print(f"[YM] Error formatting track in batch: {e}")
                        continue
                
                all_tracks.extend(formatted_tracks)
                print(f"[YM] Batch {batch_num}: loaded {len(formatted_tracks)} tracks")
            else:
                print(f"[YM] Batch {batch_num}: no tracks returned")
                
        except Exception as e:
            print(f"[YM] Error loading batch {batch_num}: {e}")
            continue
    
    print(f"[YM] Total loaded: {len(all_tracks)} out of {len(track_ids)} tracks")
    return all_tracks

def get_yandex_playlists():
    """Получить пользовательские плейлисты из Яндекс.Музыки"""
    if not YM_CLIENT:
        print("[YM] Client not initialized")
        return []
    
    try:
        # Сначала получаем список плейлистов
        print("[YM] Getting user playlists list")
        playlists_list = YM_CLIENT.users_playlists_list()
        
        if not playlists_list:
            print("[YM] No playlists found")
            return []
        
        print(f"[YM] Found {len(playlists_list)} playlists")
        formatted_playlists = []
        
        for i, playlist_short in enumerate(playlists_list):
            try:
                playlist_name = getattr(playlist_short, 'title', f'Playlist {i+1}')
                print(f"[YM] Processing playlist {i+1}/{len(playlists_list)}: '{playlist_name}'")
                
                # Проверяем наличие необходимых данных
                if not hasattr(playlist_short, 'uid') or not hasattr(playlist_short, 'kind'):
                    print(f"[YM] Skipping playlist '{playlist_name}': missing uid or kind")
                    continue
                
                # Получаем полную информацию о плейлисте используя правильный порядок параметров
                try:
                    full_playlist = YM_CLIENT.users_playlists(playlist_short.kind, playlist_short.uid)
                except Exception as playlist_error:
                    error_msg = str(playlist_error)
                    if 'playlist-not-found' in error_msg:
                        print(f"[YM] Playlist '{playlist_name}' not found or private - skipping")
                    elif 'playlistIdBindingError' in error_msg:
                        print(f"[YM] Playlist '{playlist_name}' has binding issues - skipping")
                    else:
                        print(f"[YM] Error accessing playlist '{playlist_name}': {error_msg}")
                    continue
                
                if not full_playlist:
                    print(f"[YM] Empty playlist data for '{playlist_name}' - creating empty playlist")
                    # Создаем пустой плейлист
                    # Пытаемся получить обложку даже для пустого плейлиста
                    cover_uri = None
                    try:
                        if hasattr(playlist_short, 'cover') and playlist_short.cover:
                            if hasattr(playlist_short.cover, 'uri') and playlist_short.cover.uri:
                                cover_uri = f"https://{playlist_short.cover.uri.replace('%%', '400x400')}"
                    except Exception as cover_error:
                        print(f"[YM] Error getting cover for empty playlist '{playlist_name}': {cover_error}")

                    formatted_playlist = {
                        "id": f"{playlist_short.uid}:{playlist_short.kind}",
                        "name": playlist_name,
                        "tracks": [],
                        "track_count": 0,
                        "description": getattr(playlist_short, 'description', '') or '',
                        "public": getattr(playlist_short, 'visibility', 'private') == 'public',
                        "cover": cover_uri
                    }
                    formatted_playlists.append(formatted_playlist)
                    print(f"[YM] Added empty playlist: '{playlist_name}'")
                    continue
                
                # Собираем ID треков из плейлиста
                track_ids = []
                if hasattr(full_playlist, 'tracks') and full_playlist.tracks:
                    for track_short in full_playlist.tracks:
                        try:
                            if hasattr(track_short, 'track') and track_short.track:
                                track = track_short.track
                                # Получаем ID трека
                                if hasattr(track, 'track_id') and track.track_id:
                                    track_ids.append(str(track.track_id))
                                elif hasattr(track, 'id') and track.id:
                                    track_ids.append(str(track.id))
                        except Exception as e:
                            print(f"[YM] Error extracting track ID in playlist '{playlist_name}': {e}")
                            continue
                
                # Загружаем полную информацию о треках батчами
                tracks = []
                if track_ids:
                    print(f"[YM] Loading {len(track_ids)} tracks for playlist '{playlist_name}'")
                    tracks = get_tracks_by_ids_batch(track_ids)
                
                # Получаем обложку плейлиста
                cover_uri = None
                try:
                    if hasattr(full_playlist, 'cover') and full_playlist.cover:
                        if hasattr(full_playlist.cover, 'uri') and full_playlist.cover.uri:
                            cover_uri = f"https://{full_playlist.cover.uri.replace('%%', '400x400')}"
                    elif hasattr(playlist_short, 'cover') and playlist_short.cover:
                        if hasattr(playlist_short.cover, 'uri') and playlist_short.cover.uri:
                            cover_uri = f"https://{playlist_short.cover.uri.replace('%%', '400x400')}"
                    # Если нет обложки плейлиста, используем обложку первого трека
                    elif tracks and len(tracks) > 0 and tracks[0].get('thumbnail'):
                        cover_uri = tracks[0]['thumbnail']
                except Exception as cover_error:
                    print(f"[YM] Error getting playlist cover for '{playlist_name}': {cover_error}")

                # Создаем плейлист
                formatted_playlist = {
                    "id": f"{playlist_short.uid}:{playlist_short.kind}",
                    "name": playlist_name,
                    "tracks": tracks,
                    "track_count": len(tracks),
                    "description": getattr(full_playlist, 'description', '') or getattr(playlist_short, 'description', '') or '',
                    "public": getattr(full_playlist, 'visibility', getattr(playlist_short, 'visibility', 'private')) == 'public',
                    "cover": cover_uri
                }
                
                formatted_playlists.append(formatted_playlist)
                print(f"[YM] Successfully added playlist: '{playlist_name}' ({len(tracks)} tracks)")
                
            except Exception as e:
                playlist_name = getattr(playlist_short, 'title', f'Playlist {i+1}')
                print(f"[YM] Error processing playlist '{playlist_name}': {e}")
                continue
        
        print(f"[YM] Found {len(formatted_playlists)} playlists")
        return formatted_playlists
        
    except Exception as e:
        print(f"[YM] Error getting playlists: {e}")
        return []

def get_yandex_liked_tracks():
    """Получить любимые треки из Яндекс.Музыки"""
    if not YM_CLIENT:
        print("[YM] Client not initialized")
        return []
    
    try:
        print("[YM] Getting liked tracks list")
        liked_tracks = YM_CLIENT.users_likes_tracks()
        
        if not liked_tracks:
            print("[YM] No liked tracks data received")
            return []
            
        if not hasattr(liked_tracks, 'tracks') or not liked_tracks.tracks:
            print("[YM] No liked tracks found in response")
            return []
        
        # Собираем ID треков из TrackShort объектов
        track_ids = []
        total_tracks = len(liked_tracks.tracks)
        print(f"[YM] Found {total_tracks} liked tracks, extracting IDs...")
        
        for i, track_short in enumerate(liked_tracks.tracks):
            try:
                # TrackShort объекты содержат track_id в формате "id:album_id"
                track_id = None
                if hasattr(track_short, 'track_id'):
                    track_id = track_short.track_id
                elif hasattr(track_short, 'id'):
                    track_id = track_short.id
                
                if track_id:
                    # Извлекаем только ID трека (до двоеточия, если есть)
                    if ':' in str(track_id):
                        clean_id = str(track_id).split(':')[0]
                    else:
                        clean_id = str(track_id)
                    
                    track_ids.append(clean_id)
                    if i < 5:  # Показываем только первые 5 для дебага
                        print(f"[YM] Track {i+1}: ID = {clean_id}")
                else:
                    print(f"[YM] Track {i+1}: no valid ID found")
                    
            except Exception as e:
                print(f"[YM] Error extracting ID from liked track {i+1}: {e}")
                continue
        
        print(f"[YM] Extracted {len(track_ids)} track IDs from liked tracks")
        
        if not track_ids:
            print("[YM] No valid track IDs found in liked tracks")
            return []
        
        # Загружаем полную информацию о треках батчами
        tracks = get_tracks_by_ids_batch(track_ids)
        
        print(f"[YM] Successfully loaded {len(tracks)} out of {len(track_ids)} liked tracks")
        return tracks
        
    except Exception as e:
        print(f"[YM] Error getting liked tracks: {e}")
        return []