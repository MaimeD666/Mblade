import os, time, threading, json, requests, tempfile, shutil
from flask import Flask, request, jsonify, redirect, Response, stream_with_context, send_file, make_response
import yt_dlp
from threading import Lock

try:
    from threading_utils import youtube_cache_lock, current_playing_track_lock, queued_tracks_lock
    print("[YT] Using safe timed locks")
except ImportError:
    # Fallback для обратной совместимости
    youtube_cache_lock = Lock()
    current_playing_track_lock = Lock()
    queued_tracks_lock = Lock()
    print("[YT] Using standard locks (fallback)")

youtube_url_cache = {}
current_playing_track = None
queued_tracks = set()

def validate_cookies(cookie_file):
    if not os.path.exists(cookie_file):
        print(f"[YT_COOKIES] Cookie file not found: {cookie_file}")
        return False
    
    try:
        with open(cookie_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if not content.strip():
            print("[YT_COOKIES] Cookie file is empty")
            return False
            
        essential_cookies = ['LOGIN_INFO', 'VISITOR_INFO1_LIVE', 'SAPISID', 'APISID']
        has_essential = any(cookie in content for cookie in essential_cookies)
        
        if not has_essential:
            print("[YT_COOKIES] Missing essential cookies")
            return False
            
        print(f"[YT_COOKIES] Cookie file validated: {len(content)} chars")
        return True
        
    except Exception as e:
        print(f"[YT_COOKIES] Error validating cookies: {e}")
        return False

def update_queued_tracks(track_ids):
    try:
        if hasattr(queued_tracks_lock, 'acquire_timeout'):
            with queued_tracks_lock.acquire_timeout(timeout=5):
                queued_tracks.clear()
                for track_id in track_ids:
                    queued_tracks.add(track_id)
        else:
            with queued_tracks_lock:
                queued_tracks.clear()
                for track_id in track_ids:
                    queued_tracks.add(track_id)
        print(f"[Queue] Updated queued tracks: {len(queued_tracks)} tracks in queue")
    except Exception as e:
        print(f"[Queue] Error updating queued tracks: {e}")


def extract_audio_info(video_id, ffmpeg_dir=None, cookie_file=None):
    strategies = [
        ("with_cookies", extract_with_cookies),
        ("visitor_data", extract_with_visitor_data),
        ("minimal_headers", extract_with_minimal_headers),
        ("mobile_headers", extract_with_mobile_headers)
    ]
    
    last_error = None
    
    for strategy_name, strategy_func in strategies:
        try:
            print(f"[YT] Trying strategy: {strategy_name}")
            time.sleep(0.5)
            
            result = strategy_func(video_id, ffmpeg_dir, cookie_file)
            if result:
                print(f"[YT] Success with strategy: {strategy_name}")
                return result
                
        except Exception as e:
            error_msg = str(e).lower()
            print(f"[YT] Strategy {strategy_name} failed: {e}")
            last_error = e
            
            if "429" in error_msg or "too many requests" in error_msg:
                print("[YT] Rate limit detected, sleeping...")
                time.sleep(2)
            elif "sign in" in error_msg or "bot" in error_msg:
                continue
    
    raise Exception(f"All YouTube extraction strategies failed. Last error: {last_error}")

def extract_with_cookies(video_id, ffmpeg_dir=None, cookie_file=None):
    if not cookie_file or not validate_cookies(cookie_file):
        raise Exception("Invalid or missing cookie file")
    
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'skip_download': True,
        'noplaylist': True,
        'nocheckcertificate': True,
        'cookiefile': cookie_file,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    }
    
    if ffmpeg_dir:
        ydl_opts['ffmpeg_location'] = ffmpeg_dir
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        return process_youtube_info(info)

def extract_with_visitor_data(video_id, ffmpeg_dir=None, cookie_file=None):
    visitor_data = "CgtaU0paWk5JNTE2ayiO6vykBjIKCgJSVRIEGgAgOg%3D%3D"
    
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'skip_download': True,
        'noplaylist': True,
        'nocheckcertificate': True,
        'extractor_args': {
            'youtube': {
                'player_skip': ['webpage', 'configs'],
                'visitor_data': visitor_data
            },
            'youtubetab': {
                'skip': ['webpage']
            }
        },
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    }
    
    if ffmpeg_dir:
        ydl_opts['ffmpeg_location'] = ffmpeg_dir
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        return process_youtube_info(info)

def extract_with_minimal_headers(video_id, ffmpeg_dir=None, cookie_file=None):
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'skip_download': True,
        'noplaylist': True,
        'nocheckcertificate': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Accept': '*/*',
        }
    }
    
    if ffmpeg_dir:
        ydl_opts['ffmpeg_location'] = ffmpeg_dir
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        return process_youtube_info(info)

def extract_with_mobile_headers(video_id, ffmpeg_dir=None, cookie_file=None):
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'skip_download': True,
        'noplaylist': True,
        'nocheckcertificate': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5',
        }
    }
    
    if ffmpeg_dir:
        ydl_opts['ffmpeg_location'] = ffmpeg_dir
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        return process_youtube_info(info)

def process_youtube_info(info):
    if not info:
        raise Exception("extract_info returned None")
    
    formats = info.get('formats', [])
    m4a_formats = [f for f in formats if f.get('ext') == 'm4a' and f.get('acodec') != 'none']
    
    if m4a_formats:
        for fmt in m4a_formats:
            if fmt.get('abr') is None:
                fmt['abr'] = fmt.get('tbr', 0)
        
        m4a_formats.sort(key=lambda x: x.get('abr', 0), reverse=True)
        best_m4a = m4a_formats[0]
        
        print(f"[YT] Found m4a format, abr={best_m4a.get('abr')}k")
        
        return {
            'url': best_m4a.get('url'),
            'format_name': best_m4a.get('format_note','m4a'),
            'ext': 'm4a',
            'duration': info.get('duration', 0),
            'title': info.get('title', 'Unknown'),
            'uploader': info.get('uploader', 'Unknown')
        }
    
    audio_formats = [f for f in formats if f.get('acodec') != 'none']
    if not audio_formats:
        raise Exception("No audio formats found")
    
    for f in audio_formats:
        if f.get('abr') is None:
            f['abr'] = 0
        if f.get('tbr') is None:
            f['tbr'] = 0
    
    audio_formats.sort(key=lambda x: max(x.get('abr',0), x.get('tbr',0)), reverse=True)
    best = audio_formats[0]
    
    return {
        'url': best.get('url'),
        'format_name': best.get('format_note','unknown'),
        'ext': best.get('ext','unknown'),
        'duration': info.get('duration', 0),
        'title': info.get('title', 'Unknown'),
        'uploader': info.get('uploader', 'Unknown')
    }

def download_youtube_audio(video_id, ffmpeg_dir=None, cookie_file=None):
    try:
        print(f"[YT_DL] Starting download for {video_id}")
        
        strategies = [
            ("with_cookies", extract_with_cookies),
            ("visitor_data", extract_with_visitor_data), 
            ("minimal_headers", extract_with_minimal_headers),
            ("mobile_headers", extract_with_mobile_headers)
        ]
        
        audio_info = None
        last_error = None
        
        for strategy_name, strategy_func in strategies:
            try:
                print(f"[YT_DL] Trying download strategy: {strategy_name}")
                audio_info = strategy_func(video_id, ffmpeg_dir, cookie_file)
                if audio_info and audio_info.get('url'):
                    print(f"[YT_DL] Success with strategy: {strategy_name}")
                    break
            except Exception as e:
                print(f"[YT_DL] Strategy {strategy_name} failed: {e}")
                last_error = e
                time.sleep(0.5)
        
        if not audio_info or not audio_info.get('url'):
            raise Exception(f"All download strategies failed. Last error: {last_error}")
        
        direct_url = audio_info['url']
        ext = audio_info.get('ext', 'm4a')
        title = audio_info.get('title', 'Unknown')
        uploader = audio_info.get('uploader', 'Unknown')
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f'.{ext}')
        temp_path = temp_file.name
        temp_file.close()
        
        print(f"[YT_DL] Downloading from {direct_url[:100]}... to {temp_path}")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.youtube.com/',
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
                            print(f"[YT_DL] Progress: {progress:.1f}% ({downloaded}/{total_size} bytes)")
        
        file_size = os.path.getsize(temp_path)
        print(f"[YT_DL] Downloaded {file_size} bytes for {video_id}")
        
        if file_size < 1024:
            raise Exception(f"Downloaded file too small: {file_size} bytes")
        
        safe_title = ''.join(c for c in title if c.isalnum() or c in ' ._-').strip()
        safe_uploader = ''.join(c for c in uploader if c.isalnum() or c in ' ._-').strip()
        
        if not safe_title:
            safe_title = video_id
        
        if safe_uploader and safe_uploader != 'Unknown':
            filename = f"{safe_uploader} - {safe_title}.{ext}"
        else:
            filename = f"{safe_title}.{ext}"
        
        filename = filename[:200] + f".{ext}" if len(filename) > 200 else filename
        
        return {
            'file_path': temp_path,
            'filename': filename,
            'title': title,
            'uploader': uploader,
            'ext': ext,
            'size': file_size
        }
        
    except Exception as e:
        print(f"[YT_DL] Error downloading {video_id}: {e}")
        if 'temp_path' in locals() and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
        raise

def search_youtube(query, ffmpeg_dir=None, cookie_file=None):
    ydl_opts = {
        'format': 'bestaudio',
        'quiet': True,
        'extract_flat': True,
        'ytsearch_limit': 10,
        'skip_download': True,
        'noplaylist': True,
        'nocheckcertificate': True,
        'ignoreerrors': True
    }
    
    if ffmpeg_dir:
        ydl_opts['ffmpeg_location'] = ffmpeg_dir
    
    if cookie_file and validate_cookies(cookie_file):
        ydl_opts['cookiefile'] = cookie_file
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        data = ydl.extract_info(f"ytsearch10:{query}", download=False)
        if not data or 'entries' not in data:
            return []
        
        out = []
        for entry in data['entries']:
            if not entry:
                continue
            video_id = entry.get('id', '')
            duration = entry.get('duration', 0) or 0
            title = entry.get('title', 'Unknown Title')
            uploader = entry.get('uploader', 'Unknown Uploader')
            thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
            
            out.append({
                "id": video_id,
                "title": title,
                "duration": duration,
                "uploader": uploader,
                "thumbnail": thumbnail,
                "platform": "youtube",
                "url": f"https://www.youtube.com/watch?v={video_id}"
            })
        return out

def search_youtube_playlists(query, ffmpeg_dir=None, cookie_file=None, limit=20):
    """Поиск плейлистов на YouTube"""
    ydl_opts = {
        'quiet': True,
        'extract_flat': True,
        'skip_download': True,
        'nocheckcertificate': True,
        'ignoreerrors': True
    }
    
    if ffmpeg_dir:
        ydl_opts['ffmpeg_location'] = ffmpeg_dir
    
    if cookie_file and validate_cookies(cookie_file):
        ydl_opts['cookiefile'] = cookie_file
    
    try:
        print(f"[YT] Поиск плейлистов: '{query}'")
        
        playlists = []
        
        # Пробуем разные стратегии поиска плейлистов
        search_strategies = [
            f"ytsearch{limit}:{query} playlist",
            f"ytsearch{limit}:playlist {query}",
            f"ytsearch{limit*2}:{query}"  # Увеличиваем лимит и фильтруем плейлисты
        ]
        
        for strategy_index, search_query in enumerate(search_strategies):
            try:
                print(f"[YT] Попытка {strategy_index + 1}: {search_query}")
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    data = ydl.extract_info(search_query, download=False)
                    
                    if not data or 'entries' not in data:
                        continue
                    
                    for entry in data['entries']:
                        if not entry or len(playlists) >= limit:
                            break
                        
                        # Проверяем, является ли результат плейлистом
                        is_playlist = False
                        webpage_url = entry.get('webpage_url', '')
                        entry_type = entry.get('_type', '')
                        
                        # Различные способы определения плейлиста
                        if entry_type == 'playlist':
                            is_playlist = True
                        elif 'playlist' in webpage_url.lower():
                            is_playlist = True
                        elif 'list=' in webpage_url:
                            is_playlist = True
                        elif entry.get('playlist_count', 0) > 0:
                            is_playlist = True
                        elif 'entries' in entry and len(entry.get('entries', [])) > 1:
                            is_playlist = True
                        
                        if not is_playlist:
                            continue
                        
                        playlist_id = entry.get('id', '')
                        # Извлекаем playlist ID из URL если не найден в id
                        if not playlist_id and 'list=' in webpage_url:
                            try:
                                playlist_id = webpage_url.split('list=')[1].split('&')[0]
                            except:
                                pass
                        
                        if not playlist_id:
                            continue
                        
                        # Проверяем, не добавлен ли уже этот плейлист
                        if any(p['id'] == playlist_id for p in playlists):
                            continue
                        
                        title = entry.get('title', 'Untitled Playlist')
                        uploader = entry.get('uploader', entry.get('channel', 'Unknown Channel'))
                        
                        # Получаем количество треков
                        track_count = entry.get('playlist_count', 0)
                        if not track_count and 'entries' in entry:
                            track_count = len(entry['entries'])
                        
                        # Извлекаем thumbnail
                        thumbnail = ""
                        if entry.get('thumbnail'):
                            thumbnail = entry['thumbnail']
                        elif entry.get('thumbnails') and len(entry['thumbnails']) > 0:
                            # Берем thumbnail лучшего качества
                            thumbnails = entry['thumbnails']
                            thumbnail = thumbnails[-1]['url']
                        
                        # Формируем URL плейлиста
                        if webpage_url and 'playlist' in webpage_url:
                            playlist_url = webpage_url
                        else:
                            playlist_url = f"https://www.youtube.com/playlist?list={playlist_id}"
                        
                        formatted_playlist = {
                            "id": playlist_id,
                            "title": title,
                            "author": uploader,
                            "thumbnail": thumbnail,
                            "track_count": track_count,
                            "tracks": [],  # Пустой массив для быстрого поиска
                            "url": playlist_url,
                            "platform": "youtube"
                        }
                        
                        playlists.append(formatted_playlist)
                        print(f"[YT] Найден плейлист: '{title}' by {uploader} ({track_count} треков)")
                
                # Если нашли достаточно плейлистов, прекращаем поиск
                if len(playlists) >= limit:
                    break
                    
            except Exception as e:
                print(f"[YT] Ошибка в стратегии {strategy_index + 1}: {e}")
                continue
        
        print(f"[YT] Найдено {len(playlists)} плейлистов")
        return playlists
        
    except Exception as e:
        print(f"[YT] Общая ошибка поиска плейлистов: {e}")
        return []

def get_youtube_playlist_details(playlist_id, ffmpeg_dir=None, cookie_file=None):
    """Получить детальную информацию о плейлисте YouTube включая все треки"""
    ydl_opts = {
        'quiet': True,
        'extract_flat': True,  # Быстрая экстракция без загрузки видео
        'skip_download': True,
        'nocheckcertificate': True,
        'ignoreerrors': True
    }
    
    if ffmpeg_dir:
        ydl_opts['ffmpeg_location'] = ffmpeg_dir
    
    if cookie_file and validate_cookies(cookie_file):
        ydl_opts['cookiefile'] = cookie_file
    
    try:
        print(f"[YT] Загрузка деталей плейлиста: {playlist_id}")
        
        playlist_url = f"https://www.youtube.com/playlist?list={playlist_id}"
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(playlist_url, download=False)
            
            if not info:
                print(f"[YT] Не удалось загрузить плейлист {playlist_id}")
                return None
            
            # Извлекаем основную информацию о плейлисте
            title = info.get('title', 'Untitled Playlist')
            uploader = info.get('uploader', 'Unknown Channel')
            
            # Получаем thumbnail
            thumbnail = ""
            if info.get('thumbnail'):
                thumbnail = info['thumbnail']
            elif info.get('thumbnails') and len(info['thumbnails']) > 0:
                thumbnail = info['thumbnails'][-1]['url']
            
            # Извлекаем треки
            tracks = []
            entries = info.get('entries', [])
            
            for entry in entries:
                if not entry:
                    continue
                
                video_id = entry.get('id', '')
                video_title = entry.get('title', 'Unknown Title')
                video_uploader = entry.get('uploader', uploader)  # Используем uploader плейлиста как fallback
                duration = entry.get('duration', 0) or 0
                
                # Создаем thumbnail для видео
                video_thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg" if video_id else ""
                
                track = {
                    "id": video_id,
                    "title": video_title,
                    "duration": duration,
                    "uploader": video_uploader,
                    "thumbnail": video_thumbnail,
                    "platform": "youtube",
                    "url": f"https://www.youtube.com/watch?v={video_id}"
                }
                
                tracks.append(track)
            
            formatted_playlist = {
                "id": playlist_id,
                "title": title,
                "author": uploader,
                "thumbnail": thumbnail,
                "track_count": len(tracks),
                "tracks": tracks,
                "url": playlist_url,
                "platform": "youtube"
            }
            
            print(f"[YT] Загружен плейлист '{title}' с {len(tracks)} треками")
            return formatted_playlist
            
    except Exception as e:
        print(f"[YT] Ошибка загрузки деталей плейлиста: {e}")
        return None

def get_audio_duration(filepath, ffmpeg_dir=None):
    try:
        import subprocess
        ffprobe_bin = "ffprobe"
        if ffmpeg_dir:
            ffprobe_bin = os.path.join(ffmpeg_dir, "ffprobe")
        
        cmd = [
            ffprobe_bin,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "json",
            filepath
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            duration = float(data['format']['duration'])
            return duration
        else:
            print(f"[Duration] FFprobe err: {result.stderr}")
            return 0
    except Exception as e:
        print(f"[Duration] Error: {e}")
        return 0

def send_cached_file(filepath, video_id):
    file_size = os.path.getsize(filepath)
    range_header = request.headers.get('Range', None)
    
    if range_header and range_header.startswith('bytes='):
        byte_range = range_header.replace('bytes=', '').split('-')
        start_byte = int(byte_range[0]) if byte_range[0] else 0
        end_byte = int(byte_range[1]) if len(byte_range) > 1 and byte_range[1] else file_size - 1
        
        end_byte = min(end_byte, file_size - 1)
        content_length = end_byte - start_byte + 1
        
        print(f"[SendFile] Range req {video_id}: {start_byte}-{end_byte}/{file_size}")
        with open(filepath, 'rb') as f:
            f.seek(start_byte)
            data = f.read(content_length)
        
        response = make_response(data)
        response.headers['Content-Type'] = 'audio/mpeg'
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Content-Range'] = f'bytes {start_byte}-{end_byte}/{file_size}'
        response.headers['Content-Length'] = str(content_length)
        response.status_code = 206
    else:
        print(f"[SendFile] Full req {video_id}: {file_size}b")
        response = send_file(
            filepath,
            mimetype='audio/mpeg',
            as_attachment=False,
            conditional=True
        )
        response.headers['Accept-Ranges'] = 'bytes'
        response.headers['Content-Length'] = str(file_size)
    
    response.headers['Cache-Control'] = 'public, max-age=86400'
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

def preload_tracks_async(track_ids, ffmpeg_dir=None, cookie_file=None, current_track_id=None, context='adjacent_tracks'):
    if not track_ids:
        return
    
    print(f"[Preload] Starting async preload for {len(track_ids)} tracks (context: {context})")
    
    for i, track_id in enumerate(track_ids):
        try:
            if context == 'adjacent_tracks' and current_track_id:
                # Безопасная проверка текущего трека с таймаутом
                try:
                    if hasattr(current_playing_track_lock, 'acquire_timeout'):
                        with current_playing_track_lock.acquire_timeout(timeout=2):
                            if current_playing_track:
                                current_id = current_playing_track.split(':')[-1]
                                if current_id != current_track_id:
                                    print(f"[Preload] Stopping - track changed from {current_track_id} to {current_id}")
                                    break
                    else:
                        with current_playing_track_lock:
                            if current_playing_track:
                                current_id = current_playing_track.split(':')[-1]
                                if current_id != current_track_id:
                                    print(f"[Preload] Stopping - track changed from {current_track_id} to {current_id}")
                                    break
                except Exception as e:
                    print(f"[Preload] Error checking current track: {e}")
                    continue
            
            # Безопасная проверка кэша с таймаутом
            try:
                if hasattr(youtube_cache_lock, 'acquire_timeout'):
                    with youtube_cache_lock.acquire_timeout(timeout=2):
                        cached = youtube_url_cache.get(track_id)
                        if cached and (time.time() - cached['timestamp'] < 3000):
                            print(f"[Preload] Skip {track_id} - already cached")
                            continue
                else:
                    with youtube_cache_lock:
                        cached = youtube_url_cache.get(track_id)
                        if cached and (time.time() - cached['timestamp'] < 3000):
                            print(f"[Preload] Skip {track_id} - already cached")
                            continue
            except Exception as e:
                print(f"[Preload] Error checking cache: {e}")
                continue
            
            print(f"[Preload] Getting URL for track {i+1}/{len(track_ids)}: {track_id} (context: {context})")
            
            audio_info = extract_audio_info(track_id, ffmpeg_dir, cookie_file)
            
            if audio_info and audio_info.get('url'):
                # Безопасное сохранение в кэш с таймаутом
                try:
                    if hasattr(youtube_cache_lock, 'acquire_timeout'):
                        with youtube_cache_lock.acquire_timeout(timeout=5):
                            youtube_url_cache[track_id] = {
                                "url": audio_info['url'],
                                "timestamp": time.time(),
                                "format": audio_info.get('format_name', 'unknown'),
                                "duration": audio_info.get('duration', 0),
                                "preloaded": True,
                                "context": context
                            }
                    else:
                        with youtube_cache_lock:
                            youtube_url_cache[track_id] = {
                                "url": audio_info['url'],
                                "timestamp": time.time(),
                                "format": audio_info.get('format_name', 'unknown'),
                                "duration": audio_info.get('duration', 0),
                                "preloaded": True,
                                "context": context
                            }
                except Exception as e:
                    print(f"[Preload] Error caching track {track_id}: {e}")
                    continue
                
                print(f"[Preload] Cached URL for {track_id}: {audio_info['url'][:100]}...")
            else:
                print(f"[Preload] Failed to get URL for {track_id}")
                
        except Exception as e:
            print(f"[Preload] Error for track {track_id}: {e}")
        
        delay = 0.3 if context == 'shuffle_start' else 0.5
        time.sleep(delay)
    
    print(f"[Preload] Completed preloading session (context: {context})")

def is_url_cached_and_valid(track_id, max_age_seconds=3600):
    with youtube_cache_lock:
        cached = youtube_url_cache.get(track_id)
        if not cached:
            return False
        
        age = time.time() - cached['timestamp']
        return age < max_age_seconds

def setup_youtube_routes(app, FFMPEG_DIR, COOKIE_FILE, CACHE_DIR, SAVED_DIR, load_saved_tracks):
    
    @app.route('/api/stream/youtube', methods=['GET'])
    def stream_youtube():
        video_id = request.args.get('id', '').strip()
        if not video_id:
            return jsonify({"error": "Video ID is required"}), 400
        
        try:
            audio_info = extract_audio_info(video_id, FFMPEG_DIR, COOKIE_FILE)
            if not audio_info or not audio_info.get('url'):
                return jsonify({"error": "No direct audio URL found"}), 500
            
            direct_url = audio_info['url']
            return redirect(direct_url)
            
        except Exception as e:
            print(f"[YT] Error: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/fast-stream/youtube', methods=['GET'])
    def fast_stream_youtube():
        video_id = request.args.get('id', '').strip()
        if not video_id:
            return jsonify({"error": "Video ID is required"}), 400
        
        try:
            with youtube_cache_lock:
                now = time.time()
                cached = youtube_url_cache.get(video_id)
                
                if cached and (now - cached['timestamp'] < 3600):
                    direct_url = cached['url']
                    was_preloaded = cached.get('preloaded', False)
                    
                    cached['preloaded'] = False
                    cached['used'] = True
                    
                    if was_preloaded:
                        print(f"[YT] Using preloaded URL: {video_id}")
                    else:
                        print(f"[YT] Cache hit: {video_id}")
                else:
                    print(f"[YT] Cache miss for {video_id}, extracting fresh URL")
                    audio_info = extract_audio_info(video_id, FFMPEG_DIR, COOKIE_FILE)
                    if not audio_info or not audio_info.get('url'):
                        return jsonify({"error": "No direct audio URL found"}), 500
                    
                    direct_url = audio_info['url']
                    
                    youtube_url_cache[video_id] = {
                        "url": direct_url,
                        "timestamp": time.time(),
                        "format": audio_info.get('format_name', 'unknown'),
                        "duration": audio_info.get('duration', 0),
                        "preloaded": False,
                        "used": True
                    }
                    print(f"[YT] Got fresh URL for {video_id}: {direct_url[:100]}...")
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            }
            
            if 'Range' in request.headers:
                headers['Range'] = request.headers['Range']
            
            response = requests.get(direct_url, headers=headers, stream=True)
            
            if response.status_code not in [200, 206]:
                print(f"[YT] Proxy error: {response.status_code}")
                return jsonify({"error": f"Upstream error: {response.status_code}"}), 500
            
            def generate():
                try:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            yield chunk
                except Exception as e:
                    print(f"[YT] Stream error: {e}")
            
            flask_response = Response(
                stream_with_context(generate()),
                status=response.status_code,
                mimetype='audio/mp4'
            )
            
            for header in ['Content-Length', 'Content-Range', 'Accept-Ranges']:
                if header in response.headers:
                    flask_response.headers[header] = response.headers[header]
            
            flask_response.headers['Access-Control-Allow-Origin'] = '*'
            flask_response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            flask_response.headers['Access-Control-Allow-Headers'] = 'Range'
            flask_response.headers['Cache-Control'] = 'public, max-age=3600'
            
            print(f"[YT] Proxying stream for {video_id}")
            return flask_response
            
        except Exception as e:
            print(f"[YT] Fast stream error: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @app.route('/api/download/youtube', methods=['GET'])
    def download_youtube():
        video_id = request.args.get('id', '').strip()
        if not video_id:
            return jsonify({"error": "Video ID is required"}), 400
        
        temp_file_path = None
        try:
            print(f"[YT_DL] Download request for {video_id}")
            
            download_info = download_youtube_audio(video_id, FFMPEG_DIR, COOKIE_FILE)
            temp_file_path = download_info['file_path']
            filename = download_info['filename']
            
            print(f"[YT_DL] Sending file: {filename} ({download_info.get('size', 0)} bytes)")
            
            ext = download_info.get('ext', 'm4a').lower()
            if ext == 'm4a':
                mimetype = 'audio/mp4'
            elif ext == 'mp3':
                mimetype = 'audio/mpeg'
            elif ext == 'webm':
                mimetype = 'audio/webm'
            else:
                mimetype = 'audio/mpeg'
            
            def remove_temp_file():
                try:
                    if temp_file_path and os.path.exists(temp_file_path):
                        os.unlink(temp_file_path)
                        print(f"[YT_DL] Cleaned up temp file: {temp_file_path}")
                except Exception as e:
                    print(f"[YT_DL] Error cleaning temp file: {e}")
            
            response = send_file(
                temp_file_path,
                as_attachment=True,
                download_name=filename,
                mimetype=mimetype
            )
            
            @response.call_on_close
            def cleanup(response):
                remove_temp_file()
            
            return response
            
        except Exception as e:
            print(f"[YT_DL] Download error: {str(e)}")
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
            elif "extraction" in error_message.lower() or "strategies failed" in error_message.lower():
                error_code = 503
                user_message = "Не удалось получить ссылку на трек"
            elif "connection" in error_message.lower() or "network" in error_message.lower():
                error_code = 502
                user_message = "Ошибка сети при скачивании"
            else:
                user_message = "Ошибка скачивания"
            
            return jsonify({
                "error": error_message, 
                "message": user_message,
                "platform": "youtube"
            }), error_code

    @app.route('/api/update-queue', methods=['POST'])
    def update_queue_route():
        try:
            data = request.json
            if not data or 'tracks' not in data:
                return jsonify({"error": "Tracks list is required"}), 400
            
            tracks = data['tracks']
            youtube_track_ids = [track['id'] for track in tracks 
                              if track.get('platform') == 'youtube']
            
            update_queued_tracks(youtube_track_ids)
            
            return jsonify({
                "success": True, 
                "queued_tracks": len(youtube_track_ids),
                "message": "Queue updated successfully"
            })
        except Exception as e:
            print(f"[Queue] Error updating queue: {e}")
            return jsonify({"error": str(e)}), 500
    
    @app.route('/api/youtube/search-playlists', methods=['GET'])
    def youtube_search_playlists():
        try:
            query = request.args.get('query', '').strip()
            if not query:
                return jsonify({"error": "Search query is required"}), 400
            
            limit = int(request.args.get('limit', 20))
            
            playlists = search_youtube_playlists(query, FFMPEG_DIR, COOKIE_FILE, limit)
            return jsonify({
                "success": True,
                "playlists": playlists
            })
        except Exception as e:
            print(f"[YT] Error searching playlists: {e}")
            return jsonify({
                "success": False,
                "error": str(e),
                "playlists": []
            }), 500
    
    @app.route('/api/youtube/playlist-details', methods=['GET'])
    def youtube_playlist_details():
        try:
            playlist_id = request.args.get('id', '').strip()
            if not playlist_id:
                return jsonify({"error": "Playlist ID is required"}), 400
            
            playlist = get_youtube_playlist_details(playlist_id, FFMPEG_DIR, COOKIE_FILE)
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
            print(f"[YT] Error getting playlist details: {e}")
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500
    
    return app