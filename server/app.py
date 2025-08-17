import sys
import os, time, threading, platform, json, shutil, signal, atexit
import logging, io, traceback
from io import BytesIO
from flask import Flask, request, jsonify, redirect, Response, stream_with_context, send_file, make_response
from flask_cors import CORS

import youtube_services
import soundcloud_services
import lyrics_services
# import audio_analysis  # Temporarily disabled

try:
    from youtube_auth import youtube_login_selenium, get_youtube_auth_status
    SELENIUM_AVAILABLE = True
    print("[Auth] Selenium authentication available")
except ImportError as e:
    SELENIUM_AVAILABLE = False
    print(f"[Auth] Selenium not available: {e}")
    print("[Auth] YouTube authentication will be limited to manual cookies")

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

server_running = True

app = Flask(__name__)
CORS(app)

def get_user_data_dir():
    if platform.system() == "Windows":
        appdata_dir = os.environ.get("APPDATA")
        if not appdata_dir:
            appdata_dir = os.path.join(os.path.expanduser("~"), "AppData", "Roaming")
    elif platform.system() == "Darwin":
        appdata_dir = os.path.join(os.path.expanduser("~"), "Library", "Application Support")
    else:
        appdata_dir = os.path.join(os.path.expanduser("~"), ".config")
    
    mblade_dir = os.path.join(appdata_dir, "MBlade")
    
    os.makedirs(mblade_dir, exist_ok=True)
    
    return mblade_dir

USER_DATA_DIR = get_user_data_dir()
print(f"[U] User data dir: {USER_DATA_DIR}")

log_file_path = os.path.join(USER_DATA_DIR, "server.log")
file_handler = logging.FileHandler(log_file_path, mode='w', encoding='utf-8')
file_handler.setLevel(logging.INFO)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[file_handler, console_handler]
)

logger = logging.getLogger('MBlade')

class StreamToLogger:
    def __init__(self, logger, log_level):
        self.logger = logger
        self.log_level = log_level

    def write(self, message):
        for line in message.rstrip().splitlines():
            self.logger.log(self.log_level, line.rstrip())

    def flush(self):
        pass

sys.stdout = StreamToLogger(logger, logging.INFO)
sys.stderr = StreamToLogger(logger, logging.ERROR)

PLAYLISTS_FILE = os.path.join(USER_DATA_DIR, "playlists.json")
logger.info(f"[P] Playlists file path: {PLAYLISTS_FILE}")
SAVED_TRACKS_FILE = os.path.join(USER_DATA_DIR, "saved_tracks.json")
COOKIE_FILE = os.path.join(USER_DATA_DIR, "youtube_cookies.txt")

CACHE_DIR = os.path.join(USER_DATA_DIR, "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
print(f"[C] Cache dir: {CACHE_DIR}")

SAVED_DIR = os.path.join(USER_DATA_DIR, "saved_tracks")
os.makedirs(SAVED_DIR, exist_ok=True)
print(f"[S] Saved dir: {SAVED_DIR}")

GIFS_DIR = os.path.join(USER_DATA_DIR, "gifs")
os.makedirs(GIFS_DIR, exist_ok=True)
print(f"[G] GIFs dir: {GIFS_DIR}")

STATS_DIR = os.path.join(USER_DATA_DIR, "stats")
os.makedirs(STATS_DIR, exist_ok=True)
print(f"[ST] Stats dir: {STATS_DIR}")

SETTINGS_DIR = os.path.join(USER_DATA_DIR, "settings")
os.makedirs(SETTINGS_DIR, exist_ok=True)
print(f"[SE] Settings dir: {SETTINGS_DIR}")

SOUNDCLOUD_SETTINGS_FILE = os.path.join(SETTINGS_DIR, "soundcloud_settings.json")

def get_ffmpeg_path():
    system = platform.system().lower()
    
    if hasattr(sys, '_MEIPASS'):
        base_path = os.path.join(sys._MEIPASS, 'bin', 'ffmpeg')
    else:
        base_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bin', 'ffmpeg')
    
    if system == 'windows':
        ffmpeg_path = os.path.join(base_path, 'windows', 'ffmpeg.exe')
        ffprobe_path = os.path.join(base_path, 'windows', 'ffprobe.exe')
    elif system == 'darwin':
        ffmpeg_path = os.path.join(base_path, 'macos', 'ffmpeg')
        ffprobe_path = os.path.join(base_path, 'macos', 'ffprobe')
    else:
        ffmpeg_path = os.path.join(base_path, 'linux', 'ffmpeg')
        ffprobe_path = os.path.join(base_path, 'linux', 'ffprobe')
    
    if not os.path.exists(ffmpeg_path):
        print(f"[FF] Not found: {ffmpeg_path}")
        return None
    
    if system != 'windows':
        try:
            os.chmod(ffmpeg_path, 0o755)
            os.chmod(ffprobe_path, 0o755)
        except Exception as e:
            print(f"[FF] Chmod err: {e}")
    
    return os.path.dirname(ffmpeg_path)

FFMPEG_DIR = get_ffmpeg_path()
print(f"[FF] Using: {FFMPEG_DIR or 'system ffmpeg'}")

MAX_CACHE_SIZE = 1 * 1024 * 1024 * 1024
CACHE_EXPIRY = 3600


def load_playlists():
    try:
        if os.path.exists(PLAYLISTS_FILE):
            logger.info(f"[P] Loading playlists from {PLAYLISTS_FILE}")
            with open(PLAYLISTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if 'liked_tracks' not in data:
                    data['liked_tracks'] = []
                return data
        else:
            logger.warning(f"[P] Playlists file not found at {PLAYLISTS_FILE}, creating new.")
            data = {"playlists": [], "liked_tracks": []}
            with open(PLAYLISTS_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return data

    except PermissionError as e:
        logger.error(f"[P] Permission denied accessing playlists file at {PLAYLISTS_FILE}: {e}")
        return {"playlists": [], "liked_tracks": []}

    except Exception as e:
        logger.error(f"[P] Error loading playlists from {PLAYLISTS_FILE}: {e}")
        return {"playlists": [], "liked_tracks": []}

def save_playlists(data):
    max_attempts = 5
    base_delay = 0.1
    
    for attempt in range(max_attempts):
        try:
            playlists_dir = os.path.dirname(PLAYLISTS_FILE)
            os.makedirs(playlists_dir, exist_ok=True)
            
            temp_file = f"{PLAYLISTS_FILE}.{time.time()}.temp"
            
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            
            try:
                if os.path.exists(PLAYLISTS_FILE):
                    backup_file = f"{PLAYLISTS_FILE}.bak"
                    try:
                        shutil.copy2(PLAYLISTS_FILE, backup_file)
                    except Exception as be:
                        print(f"[P] Backup warning: {be}")
                
                if os.path.exists(PLAYLISTS_FILE):
                    try:
                        os.remove(PLAYLISTS_FILE)
                    except Exception as re:
                        print(f"[P] Warning cleaning target: {re}")
                
                shutil.move(temp_file, PLAYLISTS_FILE)
            except Exception as move_error:
                print(f"[P] Move error (attempt {attempt+1}): {move_error}")
                try:
                    shutil.copy2(temp_file, PLAYLISTS_FILE)
                    try:
                        os.remove(temp_file)
                    except:
                        pass
                except Exception as copy_error:
                    print(f"[P] Copy fallback error: {copy_error}")
                    raise
            
            if os.path.exists(PLAYLISTS_FILE):
                print(f"[P] Playlists saved successfully, size: {os.path.getsize(PLAYLISTS_FILE)} bytes")
                logger.info(f"Playlists saved successfully to {PLAYLISTS_FILE}")
                try:
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
                except:
                    pass
                return True
            else:
                raise Exception(f"Save succeeded but file {PLAYLISTS_FILE} not found")
                
        except Exception as e:
            delay = base_delay * (2 ** attempt)
            print(f"[P] Save error (attempt {attempt+1}/{max_attempts}): {e}")
            logger.error(f"Error saving playlists (attempt {attempt+1}): {e}")
            
            if attempt < max_attempts - 1:
                print(f"[P] Retrying in {delay:.2f} seconds...")
                time.sleep(delay)
            else:
                logger.error(f"Failed to save playlists after {max_attempts} attempts")
                logger.error(traceback.format_exc())
                try:
                    with open(PLAYLISTS_FILE, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    print(f"[P] Emergency direct write successful")
                    logger.info("Emergency direct write successful")
                    return True
                except Exception as final_e:
                    print(f"[P] Final direct write failed: {final_e}")
                    logger.error(f"Final direct write failed: {final_e}")
                return False
    
    return False

def load_saved_tracks():
    if os.path.exists(SAVED_TRACKS_FILE):
        try:
            with open(SAVED_TRACKS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[ST] Load error: {e}")
    return {"saved_tracks": []}

def save_saved_tracks(data):
    max_attempts = 5
    base_delay = 0.1
    
    for attempt in range(max_attempts):
        try:
            tracks_dir = os.path.dirname(SAVED_TRACKS_FILE)
            os.makedirs(tracks_dir, exist_ok=True)
            
            temp_file = f"{SAVED_TRACKS_FILE}.{time.time()}.temp"
            
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            
            try:
                if os.path.exists(SAVED_TRACKS_FILE):
                    backup_file = f"{SAVED_TRACKS_FILE}.bak"
                    try:
                        shutil.copy2(SAVED_TRACKS_FILE, backup_file)
                    except Exception as be:
                        print(f"[ST] Backup warning: {be}")
                
                if os.path.exists(SAVED_TRACKS_FILE):
                    try:
                        os.remove(SAVED_TRACKS_FILE)
                    except Exception as re:
                        print(f"[ST] Warning cleaning target: {re}")
                
                shutil.move(temp_file, SAVED_TRACKS_FILE)
            except Exception as move_error:
                print(f"[ST] Move error (attempt {attempt+1}): {move_error}")
                try:
                    shutil.copy2(temp_file, SAVED_TRACKS_FILE)
                    try:
                        os.remove(temp_file)
                    except:
                        pass
                except Exception as copy_error:
                    print(f"[ST] Copy fallback error: {copy_error}")
                    raise
            
            if os.path.exists(SAVED_TRACKS_FILE):
                print(f"[ST] Saved tracks saved, size: {os.path.getsize(SAVED_TRACKS_FILE)} bytes")
                try:
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
                except:
                    pass
                return True
            else:
                raise Exception(f"Save succeeded but file {SAVED_TRACKS_FILE} not found")
                
        except Exception as e:
            delay = base_delay * (2 ** attempt)
            print(f"[ST] Save error (attempt {attempt+1}/{max_attempts}): {e}")
            
            if attempt < max_attempts - 1:
                print(f"[ST] Retrying in {delay:.2f} seconds...")
                time.sleep(delay)
            else:
                print(f"[ST] Failed to save tracks after {max_attempts} attempts")
                try:
                    with open(SAVED_TRACKS_FILE, "w", encoding="utf-8") as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    print(f"[ST] Emergency direct write successful")
                    return True
                except Exception as final_e:
                    print(f"[ST] Final direct write failed: {final_e}")
                return False
    
    return False

def clean_cache():
    while server_running:
        try:
            time.sleep(CACHE_EXPIRY)
            print(f"[Cache] Starting cache cleanup")
            
            with youtube_services.youtube_cache_lock:
                now = time.time()
                to_remove = []
                stats = {
                    'expired': 0,
                    'unused_preloaded': 0,
                    'old_used': 0,
                    'kept': 0
                }
                
                for k, v in youtube_services.youtube_url_cache.items():
                    age = now - v['timestamp']
                    
                    if age > CACHE_EXPIRY:
                        to_remove.append(k)
                        stats['expired'] += 1
                    elif v.get('preloaded', False) and age > 1800:
                        to_remove.append(k)
                        stats['unused_preloaded'] += 1
                    elif v.get('used', False) and age > 7200:
                        to_remove.append(k)
                        stats['old_used'] += 1
                    else:
                        stats['kept'] += 1
                
                for k in to_remove:
                    del youtube_services.youtube_url_cache[k]
                
                total_removed = len(to_remove)
            
            if total_removed > 0:
                print(f"[Cache] Cleanup completed: removed {total_removed} entries "
                      f"(expired: {stats['expired']}, unused preloaded: {stats['unused_preloaded']}, "
                      f"old used: {stats['old_used']}, kept: {stats['kept']})")
            
        except Exception as e:
            error_msg = f"[Cache] Error cleaning cache: {e}"
            print(error_msg)
            logger.error(error_msg)
            logger.error(f"Cache cleanup exception: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Cache cleanup traceback: {traceback.format_exc()}")

@app.route('/api/search', methods=['GET'])
def search_all():
    query = request.args.get('query', '').strip()
    if not query:
        return jsonify({"error": "Query parameter is required"}), 400
    
    results = {
        "youtube": [],
        "soundcloud": [],
        "vkmusic": []
    }
    
    try:
        start_t = time.time()
        results["youtube"] = youtube_services.search_youtube(query, FFMPEG_DIR, COOKIE_FILE)
        print(f"[YT] '{query}' in {time.time()-start_t:.2f}s")
    except Exception as e:
        error_msg = f"[YT] Error: {e}"
        print(error_msg)
        logger.error(f"YouTube search error for '{query}': {type(e).__name__}: {str(e)}")
    
    try:
        start_s = time.time()
        soundcloud_client_id = soundcloud_services.get_soundcloud_client_id(SOUNDCLOUD_SETTINGS_FILE)
        results["soundcloud"] = soundcloud_services.search_soundcloud(query, soundcloud_client_id)
        print(f"[SC] '{query}' in {time.time()-start_s:.2f}s")
    except Exception as e:
        error_msg = f"[SC] Error: {e}"
        print(error_msg)
        logger.error(f"SoundCloud search error for '{query}': {type(e).__name__}: {str(e)}")
    
    results["vkmusic"] = []
    
    return jsonify(results)

@app.route('/api/lyrics', methods=['GET'])
def get_lyrics():
    title = request.args.get('title', '').strip()
    artist = request.args.get('artist', '').strip()
    
    if not title or not artist:
        return jsonify({"error": "Title and artist required"}), 400
    
    try:
        result = lyrics_services.get_lyrics(title, artist)
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 404
            
    except Exception as e:
        print(f"[Lyrics] Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/playlists', methods=['GET'])
def get_playlists():
    data = load_playlists()
    if 'liked_tracks' not in data:
        data['liked_tracks'] = []
    return jsonify(data)

@app.route('/api/playlists/track-chunk', methods=['POST'])
def save_track_chunk():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        required_fields = ['playlistId', 'trackChunk', 'chunkIndex', 'totalChunks']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        playlist_id = str(data['playlistId'])
        chunk_index = data['chunkIndex']
        total_chunks = data['totalChunks']
        tracks = data['trackChunk']
        
        playlists_data = load_playlists()
        
        for playlist in playlists_data.get('playlists', []):
            if str(playlist.get('id')) == playlist_id:
                for track in tracks:
                    if track not in playlist['tracks']:
                        playlist['tracks'].append(track)
                break
        
        success = save_playlists(playlists_data)
        if not success:
            return jsonify({"error": "Failed to save playlists"}), 500
        
        return jsonify({
            "success": True, 
            "message": f"Chunk {chunk_index+1}/{total_chunks} saved for playlist {playlist_id}"
        })
    
    except Exception as e:
        print(f"[P] Error saving track chunk: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/playlists', methods=['POST'])
def update_playlists():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        is_partial_update = 'group_index' in data and 'total_groups' in data
        
        if is_partial_update:
            group_index = data['group_index']
            total_groups = data['total_groups']
            print(f"[P] Received playlist group {group_index+1}/{total_groups}")
            
            current_data = load_playlists()
            
            liked_tracks = data.get('liked_tracks', [])
            current_data['liked_tracks'] = liked_tracks
            
            new_playlists = data.get('playlists', [])
            
            existing_ids = [p.get('id') for p in current_data.get('playlists', [])]
            
            for new_playlist in new_playlists:
                new_id = new_playlist.get('id')
                if new_id in existing_ids:
                    for i, playlist in enumerate(current_data['playlists']):
                        if playlist.get('id') == new_id:
                            current_data['playlists'][i] = new_playlist
                            break
                else:
                    current_data.setdefault('playlists', []).append(new_playlist)
            
            success = save_playlists(current_data)
            if not success:
                return jsonify({"error": "Failed to save playlists"}), 500
            
            return jsonify({
                "success": True, 
                "message": f"Group {group_index+1}/{total_groups} saved successfully"
            })
        else:
            success = save_playlists(data)
            if not success:
                return jsonify({"error": "Failed to save playlists"}), 500
            
            return jsonify({"success": True})
    except Exception as e:
        print(f"[P] Error updating playlists: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/set-current-track', methods=['POST'])
def set_current_track():
    try:
        data = request.json
        if not data or 'track_id' not in data or 'platform' not in data:
            return jsonify({"error": "Track ID and platform required"}), 400
        
        track_id = data['track_id']
        platform = data['platform']
        
        with youtube_services.current_playing_track_lock:
            youtube_services.current_playing_track = f"{platform}:{track_id}"
            print(f"[CT] Set: {youtube_services.current_playing_track}")
        
        return jsonify({"success": True, "current_track": youtube_services.current_playing_track})
    except Exception as e:
        print(f"[CT] Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-current-track', methods=['GET'])
def get_current_track():
    with youtube_services.current_playing_track_lock:
        return jsonify({"current_track": youtube_services.current_playing_track})

@app.route('/api/youtube/preload-tracks', methods=['POST'])
def preload_youtube_tracks():
    try:
        data = request.json
        if not data or 'track_ids' not in data:
            return jsonify({"error": "Track IDs list is required"}), 400
        
        track_ids = data['track_ids']
        current_track_id = data.get('current_track_id')
        context = data.get('context', 'adjacent_tracks')
        
        if not track_ids or not isinstance(track_ids, list):
            return jsonify({"error": "Invalid track_ids format"}), 400
        
        tracks_to_preload = []
        with youtube_services.youtube_cache_lock:
            now = time.time()
            for track_id in track_ids:
                cached = youtube_services.youtube_url_cache.get(track_id)
                if not cached or (now - cached['timestamp'] > 3000):
                    tracks_to_preload.append(track_id)
                else:
                    print(f"[Preload] Skip {track_id} - already cached")
        
        if not tracks_to_preload:
            return jsonify({
                "success": True,
                "message": "All tracks already cached",
                "preloaded": 0,
                "skipped": len(track_ids),
                "context": context
            })
        
        threading.Thread(
            target=youtube_services.preload_tracks_async,
            args=(tracks_to_preload, FFMPEG_DIR, COOKIE_FILE, current_track_id, context),
            daemon=True
        ).start()
        
        print(f"[Preload] Started preloading {len(tracks_to_preload)} tracks for context '{context}': {tracks_to_preload}")
        
        return jsonify({
            "success": True,
            "message": f"Preloading started for {len(tracks_to_preload)} tracks",
            "preloaded": len(tracks_to_preload),
            "skipped": len(track_ids) - len(tracks_to_preload),
            "context": context
        })
        
    except Exception as e:
        print(f"[Preload] Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/saved-tracks', methods=['GET'])
def get_saved_tracks():
    data = load_saved_tracks()
    return jsonify(data)

@app.route('/api/saved-tracks', methods=['POST'])
def save_track():
    try:
        data = request.json
        if not data or 'track' not in data:
            return jsonify({"error": "Track info required"}), 400
        
        track = data['track']
        
        if 'id' not in track or 'platform' not in track or 'title' not in track:
            return jsonify({"error": "Missing required track fields"}), 400
        
        saved_data = load_saved_tracks()
        
        if any(t.get('id') == track['id'] and t.get('platform') == track['platform'] 
               for t in saved_data.get('saved_tracks', [])):
            return jsonify({"success": True, "message": "Track already saved", "saved": True})
        
        track['saved'] = True
        saved_data.setdefault('saved_tracks', []).append(track)
        
        success = save_saved_tracks(saved_data)
        if not success:
            return jsonify({"error": "Failed to save track"}), 500
        
        return jsonify({"success": True, "message": "Track saved", "saved": True})
    except Exception as e:
        print(f"[ST] Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/saved-tracks/delete', methods=['POST'])
def delete_saved_track():
    try:
        data = request.json
        if not data or 'id' not in data or 'platform' not in data:
            return jsonify({"error": "Track ID and platform required"}), 400
        
        track_id = data['id']
        platform = data['platform']
        
        saved_data = load_saved_tracks()
        
        saved_tracks = saved_data.get('saved_tracks', [])
        for i, track in enumerate(saved_tracks):
            if track.get('id') == track_id and track.get('platform') == platform:
                saved_tracks.pop(i)
                
                saved_data['saved_tracks'] = saved_tracks
                success = save_saved_tracks(saved_data)
                if not success:
                    return jsonify({"error": "Failed to update saved tracks"}), 500
                
                return jsonify({"success": True, "message": "Track removed"})
        
        return jsonify({"error": "Track not found"}), 404
    except Exception as e:
        print(f"[ST] Delete err: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/saved-tracks/check', methods=['GET'])
def check_saved_track():
    track_id = request.args.get('id', '').strip()
    platform = request.args.get('platform', '').strip()
    
    if not track_id or not platform:
        return jsonify({"error": "Track ID and platform required"}), 400
    
    saved_data = load_saved_tracks()
    
    is_saved = any(t.get('id') == track_id and t.get('platform') == platform
                   for t in saved_data.get('saved_tracks', []))
    
    return jsonify({"is_saved": is_saved})

@app.route('/api/cache/info', methods=['GET'])
def get_cache_info():
    try:
        with youtube_services.youtube_cache_lock:
            url_cache_size = len(youtube_services.youtube_url_cache)
            
            now = time.time()
            stats = {
                'total': url_cache_size,
                'expired': 0,
                'preloaded': 0,
                'used': 0,
                'fresh': 0
            }
            
            for data in youtube_services.youtube_url_cache.values():
                age = now - data['timestamp']
                
                if age > CACHE_EXPIRY:
                    stats['expired'] += 1
                elif data.get('preloaded', False):
                    stats['preloaded'] += 1
                elif data.get('used', False):
                    stats['used'] += 1
                else:
                    stats['fresh'] += 1
        
        current_time = int(time.time())
        time_since_start = current_time % CACHE_EXPIRY
        next_cleanup_seconds = CACHE_EXPIRY - time_since_start
        next_cleanup_minutes = next_cleanup_seconds // 60
        next_cleanup_hours = next_cleanup_minutes // 60
        
        return jsonify({
            "total_urls": stats['total'],
            "expired_urls": stats['expired'],
            "preloaded_urls": stats['preloaded'],
            "used_urls": stats['used'],
            "fresh_urls": stats['fresh'],
            "cache_expiry_hours": CACHE_EXPIRY / 3600,
            "next_cleanup_seconds": next_cleanup_seconds,
            "next_cleanup_minutes": next_cleanup_minutes % 60,
            "next_cleanup_hours": next_cleanup_hours
        })
    except Exception as e:
        print(f"[Cache] Error getting cache info: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/youtube/auth-status', methods=['GET'])
def youtube_auth_status():
    try:
        if not SELENIUM_AVAILABLE:
            return jsonify({
                "authenticated": False,
                "selenium_available": False,
                "message": "Selenium not installed. YouTube auth unavailable."
            })
            
        status = get_youtube_auth_status(USER_DATA_DIR)
        status["selenium_available"] = True
        return jsonify(status)
    except Exception as e:
        return jsonify({
            "authenticated": False,
            "selenium_available": SELENIUM_AVAILABLE,
            "error": str(e)
        }), 500

@app.route('/api/youtube/login', methods=['POST'])
def youtube_login():
    try:
        if not SELENIUM_AVAILABLE:
            return jsonify({
                'success': False,
                'error': 'Selenium not available',
                'message': 'Please install selenium: pip install selenium webdriver-manager'
            }), 400
            
        data = request.json or {}
        email = data.get('email')
        password = data.get('password')
        headless = data.get('headless', False)
        force_reauth = data.get('force_reauth', False)
        
        result = {'success': False, 'message': 'Login in progress...'}
        
        def login_thread():
            try:
                cookie_file = youtube_login_selenium(
                    USER_DATA_DIR, 
                    email=email, 
                    password=password, 
                    headless=headless, 
                    force_reauth=force_reauth
                )
                
                if cookie_file:
                    result['success'] = True
                    result['cookie_file'] = cookie_file
                    result['message'] = 'Authentication successful'
                else:
                    result['message'] = 'Authentication failed or cancelled'
            except Exception as e:
                result['error'] = str(e)
                result['message'] = f'Error during authentication: {str(e)}'
        
        if headless or (email and password):
            thread = threading.Thread(target=login_thread)
            thread.start()
            thread.join(timeout=300)
            
            if thread.is_alive():
                result['error'] = 'Authentication timeout'
                result['message'] = 'Authentication process timed out'
            
            return jsonify(result)
        else:
            thread = threading.Thread(target=login_thread, daemon=True)
            thread.start()
            
            return jsonify({
                'success': True,
                'message': 'Interactive login started. Check browser window.',
                'interactive': True
            })
    
    except Exception as e:
        return jsonify({
            'success': False, 
            'error': str(e),
            'message': f'Failed to start authentication: {str(e)}'
        }), 500

@app.route('/api/youtube/logout', methods=['POST'])
def youtube_logout():
    try:
        cookie_file = os.path.join(USER_DATA_DIR, 'youtube_cookies.txt')
        
        if os.path.exists(cookie_file):
            os.remove(cookie_file)
            logger.info("YouTube cookies removed")
        
        return jsonify({
            "success": True,
            "message": "Logged out successfully"
        })
    except Exception as e:
        logger.error(f"Error during YouTube logout: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/selenium/status', methods=['GET'])
def selenium_status():
    try:
        if not SELENIUM_AVAILABLE:
            return jsonify({
                "available": False,
                "error": "Selenium not imported",
                "suggestion": "Install with: pip install selenium webdriver-manager"
            })
        
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            
            chrome_options = Options()
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            
            driver = webdriver.Chrome(options=chrome_options)
            driver.get('https://www.google.com')
            driver.quit()
            
            return jsonify({
                "available": True,
                "chrome_driver": True,
                "message": "Selenium and ChromeDriver working properly"
            })
            
        except Exception as driver_error:
            return jsonify({
                "available": True,
                "chrome_driver": False,
                "error": str(driver_error),
                "suggestion": "Download ChromeDriver or install webdriver-manager"
            })
            
    except Exception as e:
        return jsonify({
            "available": False,
            "error": str(e)
        }), 500


@app.route('/api/clear-all-data', methods=['POST'])
def clear_all_data():
    try:
        logger.info("Starting complete data cleanup...")
        
        with youtube_services.youtube_cache_lock:
            cache_size = len(youtube_services.youtube_url_cache)
            youtube_services.youtube_url_cache.clear()
            logger.info(f"Cleared URL cache: {cache_size} entries")
        
        files_to_remove = [
            PLAYLISTS_FILE,
            SAVED_TRACKS_FILE,
            COOKIE_FILE,
            SOUNDCLOUD_SETTINGS_FILE,
            FIREBASE_CONFIG_FILE,
            os.path.join(SETTINGS_DIR, "theme_settings.json")
        ]
        
        removed_files = []
        for file_path in files_to_remove:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    removed_files.append(os.path.basename(file_path))
                    logger.info(f"Removed file: {file_path}")
            except Exception as e:
                logger.error(f"Error removing file {file_path}: {e}")
        
        dirs_to_clear = [CACHE_DIR, SAVED_DIR, GIFS_DIR, STATS_DIR]
        
        cleared_dirs = []
        for dir_path in dirs_to_clear:
            try:
                if os.path.exists(dir_path):
                    for filename in os.listdir(dir_path):
                        file_path = os.path.join(dir_path, filename)
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                        elif os.path.isdir(file_path):
                            shutil.rmtree(file_path)
                    cleared_dirs.append(os.path.basename(dir_path))
                    logger.info(f"Cleared directory: {dir_path}")
            except Exception as e:
                logger.error(f"Error clearing directory {dir_path}: {e}")
        
        logger.info("Complete data cleanup finished")
        
        return jsonify({
            "success": True,
            "message": "All application data cleared successfully",
            "cleared_url_cache": cache_size,
            "removed_files": removed_files,
            "cleared_directories": cleared_dirs
        })
        
    except Exception as e:
        logger.error(f"Error during complete data cleanup: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    try:
        with youtube_services.youtube_cache_lock:
            cache_size = len(youtube_services.youtube_url_cache)
            youtube_services.youtube_url_cache.clear()
        
        return jsonify({
            "success": True,
            "cleared_entries": cache_size,
            "message": "URL cache cleared successfully"
        })
    except Exception as e:
        print(f"[Cache] Error clearing URL cache: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    try:
        if os.path.exists(log_file_path):
            return send_file(
                log_file_path,
                as_attachment=True,
                download_name="mblade_server.log",
                mimetype="text/plain"
            )
        else:
            log_content = "Log file is empty or doesn't exist.\n"
            log_content += f"Server time: {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            log_content += "Restart the server to begin logging to a file."
            
            temp_log = io.BytesIO(log_content.encode('utf-8'))
            
            return Response(
                temp_log.getvalue(),
                mimetype="text/plain",
                headers={
                    "Content-Disposition": "attachment; filename=mblade_server.log"
                }
            )
    except Exception as e:
        logger.error(f"Error accessing log file: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload/mp3', methods=['POST'])
def upload_mp3():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        
        if not file.filename.lower().endswith('.mp3'):
            return jsonify({"error": "Only MP3 files are allowed"}), 400
        
        import uuid
        track_id = str(uuid.uuid4())
        
        title = request.form.get('title', 'Unknown Title')
        artist = request.form.get('artist', 'Unknown Artist')
        
        safe_filename = f"{track_id}.mp3"
        file_path = os.path.join(SAVED_DIR, safe_filename)
        
        file.save(file_path)
        
        duration = youtube_services.get_audio_duration(file_path, FFMPEG_DIR)
        
        stream_url = f"/api/stream/local?id={track_id}"
        
        return jsonify({
            "success": True,
            "id": track_id,
            "title": title,
            "artist": artist,
            "duration": duration,
            "path": file_path,
            "streamUrl": stream_url
        })
    except Exception as e:
        print(f"[Upload] Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/stream/local', methods=['GET'])
def stream_local_track():
    track_id = request.args.get('id', '').strip()
    if not track_id:
        return jsonify({"error": "Track ID is required"}), 400
    
    file_path = os.path.join(SAVED_DIR, f"{track_id}.mp3")
    
    if not os.path.exists(file_path):
        return jsonify({"error": "Track not found"}), 404
    
    return youtube_services.send_cached_file(file_path, track_id)

@app.route('/api/download/local', methods=['GET'])
def download_local_track():
    track_id = request.args.get('id', '').strip()
    if not track_id:
        return jsonify({"error": "Track ID is required"}), 400
    
    file_path = os.path.join(SAVED_DIR, f"{track_id}.mp3")
    
    if not os.path.exists(file_path):
        return jsonify({"error": "Track not found"}), 404
    
    try:
        title = f"local_{track_id}.mp3"
        
        try:
            saved_data = load_saved_tracks()
            for track in saved_data.get('saved_tracks', []):
                if track.get('id') == track_id and track.get('platform') == 'local':
                    if track.get('title'):
                        title = track.get('title')
                        title = ''.join(c for c in title if c.isalnum() or c in ' ._-')
                        title = title.strip() + '.mp3'
                    break
        except:
            pass
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=title,
            mimetype='audio/mpeg'
        )
    except Exception as e:
        print(f"[DL_LOCAL] Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/download/vkmusic', methods=['GET'])
def download_vkmusic():
    return jsonify({"error": "Download from VK Music not supported in this version"}), 501

@app.route('/api/save-theme-settings', methods=['POST'])
def save_theme_settings():
    try:
        data = request.json
        if not data or 'themeName' not in data:
            return jsonify({"error": "Theme name is required"}), 400
        
        theme_name = data['themeName']
        
        settings_path = os.path.join(SETTINGS_DIR, "theme_settings.json")
        
        if os.path.exists(settings_path):
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
        else:
            settings = {}
        
        settings['themeName'] = theme_name
        
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        
        return jsonify({"success": True})
    except Exception as e:
        print(f"[SE] Error saving theme settings: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/save-accent-color', methods=['POST'])
def save_accent_color():
    try:
        data = request.json
        if not data or 'themeName' not in data or 'accentColor' not in data:
            return jsonify({"error": "Theme name and accent color are required"}), 400
        
        theme_name = data['themeName']
        accent_color = data['accentColor']
        
        settings_path = os.path.join(SETTINGS_DIR, "theme_settings.json")
        
        if os.path.exists(settings_path):
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
        else:
            settings = {}
        
        settings['accentColor'] = accent_color
        settings['themeName'] = theme_name
        
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        
        return jsonify({"success": True})
    except Exception as e:
        print(f"[SE] Error saving accent color: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-theme-settings', methods=['GET'])
def get_theme_settings():
    try:
        settings_path = os.path.join(SETTINGS_DIR, "theme_settings.json")
        
        if os.path.exists(settings_path):
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            return jsonify(settings)
        else:
            return jsonify({"themeName": None, "accentColor": None})
    except Exception as e:
        print(f"[SE] Error getting theme settings: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/lyrics/by-url', methods=['POST'])
def get_lyrics_by_url():
    data = request.json
    if not data or 'url' not in data:
        return jsonify({"error": "URL is required"}), 400
    
    song_url = data['url']
    
    try:
        result = lyrics_services.get_lyrics_by_url(song_url)
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 404
            
    except Exception as e:
        print(f"[Lyrics] Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/lyrics/search', methods=['GET'])
def search_lyrics():
    title = request.args.get('title', '').strip()
    artist = request.args.get('artist', '').strip()
    
    if not title:
        return jsonify({"error": "Title is required"}), 400
    
    try:
        results = lyrics_services.search_genius_songs(title, artist)
        
        return jsonify({
            "success": True,
            "results": results,
            "total": len(results)
        })
        
    except Exception as e:
        print(f"[Lyrics] Search error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/export-all-data', methods=['GET'])
def export_all_data():
    try:
        playlists_data = load_playlists()
        saved_tracks_data = load_saved_tracks()
        
        settings_path = os.path.join(SETTINGS_DIR, "theme_settings.json")
        theme_settings = {}
        if os.path.exists(settings_path):
            with open(settings_path, 'r', encoding='utf-8') as f:
                theme_settings = json.load(f)
        
        soundcloud_settings = {}
        if os.path.exists(SOUNDCLOUD_SETTINGS_FILE):
            with open(SOUNDCLOUD_SETTINGS_FILE, 'r', encoding='utf-8') as f:
                soundcloud_settings = json.load(f)
        
        export_data = {
            "export_version": "1.0",
            "export_timestamp": time.time(),
            "playlists": playlists_data.get('playlists', []),
            "liked_tracks": playlists_data.get('liked_tracks', []),
            "saved_tracks": saved_tracks_data.get('saved_tracks', []),
            "theme_settings": theme_settings,
            "soundcloud_settings": soundcloud_settings
        }
        
        return jsonify({
            "success": True,
            "data": export_data
        })
    except Exception as e:
        logger.error(f"Error exporting data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/import-all-data', methods=['POST'])
def import_all_data():
    try:
        data = request.json
        if not data or 'data' not in data:
            return jsonify({"error": "No data provided"}), 400
        
        import_data = data['data']
        
        if import_data.get('playlists') or import_data.get('liked_tracks'):
            playlists_data = {
                'playlists': import_data.get('playlists', []),
                'liked_tracks': import_data.get('liked_tracks', [])
            }
            success = save_playlists(playlists_data)
            if not success:
                logger.error("Failed to import playlists data")
        
        if import_data.get('saved_tracks'):
            saved_tracks_data = {
                'saved_tracks': import_data.get('saved_tracks', [])
            }
            success = save_saved_tracks(saved_tracks_data)
            if not success:
                logger.error("Failed to import saved tracks data")
        
        if import_data.get('theme_settings'):
            settings_path = os.path.join(SETTINGS_DIR, "theme_settings.json")
            with open(settings_path, 'w', encoding='utf-8') as f:
                json.dump(import_data['theme_settings'], f, ensure_ascii=False, indent=2)
        
        if import_data.get('soundcloud_settings'):
            with open(SOUNDCLOUD_SETTINGS_FILE, 'w', encoding='utf-8') as f:
                json.dump(import_data['soundcloud_settings'], f, ensure_ascii=False, indent=2)
        
        return jsonify({
            "success": True,
            "message": "Data imported successfully"
        })
    except Exception as e:
        logger.error(f"Error importing data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/shutdown', methods=['POST'])
def shutdown():
    shutdown_server()
    return jsonify({"success": True, "message": "Server shutting down"})

def shutdown_server():
    global server_running
    server_running = False
    print("[Server] Shutting down gracefully...")
    try:
        func = request.environ.get('werkzeug.server.shutdown')
        if func is None:
            import os, signal
            os.kill(os.getpid(), signal.SIGINT)
        else:
            func()
    except Exception as e:
        print(f"[Server] Error during shutdown: {e}")
        import os, signal
        os.kill(os.getpid(), signal.SIGINT)

def signal_handler(sig, frame):
    print(f"[Server] Received signal: {sig}")
    shutdown_server()
    sys.exit(0)

@atexit.register
def clean_exit():
    global server_running
    if server_running:
        print("[Server] Cleaning up resources...")
        server_running = False
        try:
            # Принудительная остановка всех потоков
            with youtube_services.youtube_cache_lock:
                youtube_services.youtube_url_cache.clear()
            print("[Server] Cache cleared on exit")
        except Exception as e:
            print(f"[Server] Error during cleanup: {e}")

if __name__ == "__main__":
    try:
        # В Windows PyInstaller signal handlers не работают надежно
        # Полагаемся на atexit.register для очистки
        if platform.system() == "Windows" and hasattr(sys, '_MEIPASS'):
            print("[Server] Running in PyInstaller on Windows - using atexit for cleanup")
        else:
            signal.signal(signal.SIGINT, signal_handler)
            signal.signal(signal.SIGTERM, signal_handler)
        
        logger.info(f"[P] Playlists file path: {PLAYLISTS_FILE}")
        try:
            initial = load_playlists()
            logger.info(
                f"[P] Initial load: {len(initial.get('playlists', []))} playlists, "
                f"{len(initial.get('liked_tracks', []))} liked tracks"
            )
        except Exception as e:
            logger.error(f"[P] Failed initial load of playlists: {e}")
        
        app = youtube_services.setup_youtube_routes(app, FFMPEG_DIR, COOKIE_FILE, CACHE_DIR, SAVED_DIR, load_saved_tracks)
        app = soundcloud_services.setup_soundcloud_routes(app, SOUNDCLOUD_SETTINGS_FILE, FFMPEG_DIR)
        # app = audio_analysis.setup_analysis_routes(app, USER_DATA_DIR, load_playlists)  # Temporarily disabled
        
        threading.Thread(target=clean_cache, daemon=True).start()

        print("[Server] Starting server on port 5000")
        logger.info("Server starting on port 5000")
        app.run(debug=False, port=5000, use_reloader=False)
    except KeyboardInterrupt:
        print("[Server] Server stopped by keyboard interrupt")
        logger.info("Server stopped by keyboard interrupt")
    except Exception as e:
        error_msg = f"[Server] Error starting server: {e}"
        print(error_msg)
        logger.error(error_msg)
        logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
    finally:
        print("[Server] Server shutdown complete")
        logger.info("Server shutdown complete")