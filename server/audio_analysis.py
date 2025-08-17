import os
import time
import pickle
import threading
import tempfile
import shutil
import json
import numpy as np
from threading import Lock
from flask import request, jsonify

ML_AVAILABLE = False
print("[AI] ML libraries disabled (temporarily removed)")

class AudioAnalyzer:
    def __init__(self, user_data_dir):
        self.user_data_dir = user_data_dir
        self.embeddings_file = os.path.join(user_data_dir, "audio_embeddings.pkl")
        self.profile_file = os.path.join(user_data_dir, "user_profile.pkl") 
        self.analysis_stats_file = os.path.join(user_data_dir, "analysis_stats.json")
        
        self.model = None
        self.embeddings_cache = {}
        self.user_profile = {}
        self.analysis_stats = {
            'tracks_analyzed': 0,
            'analysis_sessions': 0,
            'last_analysis': None,
            'profile_strength': 0
        }
        
        self.analysis_lock = Lock()
        self.current_analysis = {
            'active': False,
            'progress': 0,
            'current_track': None,
            'total_tracks': 0,
            'errors': []
        }
        
        self.load_data()
    
    def load_data(self):
        try:
            if os.path.exists(self.embeddings_file):
                with open(self.embeddings_file, 'rb') as f:
                    self.embeddings_cache = pickle.load(f)
        except:
            self.embeddings_cache = {}
        
        try:
            if os.path.exists(self.profile_file):
                with open(self.profile_file, 'rb') as f:
                    self.user_profile = pickle.load(f)
        except:
            self.user_profile = {}
        
        try:
            if os.path.exists(self.analysis_stats_file):
                with open(self.analysis_stats_file, 'r', encoding='utf-8') as f:
                    self.analysis_stats = json.load(f)
        except:
            self.analysis_stats = {
                'tracks_analyzed': 0,
                'analysis_sessions': 0,
                'last_analysis': None,
                'profile_strength': 0
            }
    
    def save_data(self):
        try:
            with open(self.embeddings_file, 'wb') as f:
                pickle.dump(self.embeddings_cache, f)
        except Exception as e:
            print(f"[AI] Error saving embeddings: {e}")
        
        try:
            with open(self.profile_file, 'wb') as f:
                pickle.dump(self.user_profile, f)
        except Exception as e:
            print(f"[AI] Error saving profile: {e}")
        
        try:
            with open(self.analysis_stats_file, 'w', encoding='utf-8') as f:
                json.dump(self.analysis_stats, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[AI] Error saving stats: {e}")
    
    def load_model(self):
        if not ML_AVAILABLE:
            raise Exception("ML libraries not available. Install: pip install laion-clap torch torchaudio")
        
        if not self.model:
            print("[AI] Loading CLAP model...")
            try:
                self.model = laion_clap.CLAP_Module(enable_fusion=False)
                print("[AI] CLAP module initialized")
                self.model.load_ckpt()
                print("[AI] CLAP checkpoint loaded successfully (auto-download)")
                
                self.load_vocabulary()
            except Exception as e:
                print(f"[AI] Error loading CLAP model: {e}")
                print("[AI] This might be due to missing model file or network issues")
                raise
    
    def load_vocabulary(self):
        try:
            vocabulary_file = os.path.join(os.path.dirname(__file__), 'music_tag_dictionary.json')
            with open(vocabulary_file, 'r', encoding='utf-8') as f:
                tag_dict = json.load(f)
            
            self.vocabulary = []
            for category, tags in tag_dict.items():
                self.vocabulary.extend(tags)
            
            print(f"[AI] Loaded {len(self.vocabulary)} music tags")
            print(f"[AI] Sample tags: {self.vocabulary[:5]}")
            
            print("[AI] Computing text embeddings...")
            self.vocabulary_embeddings = self.model.get_text_embedding(self.vocabulary)
            print(f"[AI] Pre-computed text embeddings - shape: {self.vocabulary_embeddings.shape}")
            print(f"[AI] Text embedding sample values: min={np.min(self.vocabulary_embeddings):.3f}, max={np.max(self.vocabulary_embeddings):.3f}")
            
        except Exception as e:
            print(f"[AI] Error loading vocabulary: {e}")
            self.vocabulary = []
            self.vocabulary_embeddings = None
    
    def get_analysis_status(self):
        return {
            'active': self.current_analysis['active'],
            'progress': self.current_analysis['progress'],
            'current_track': self.current_analysis['current_track'],
            'total_tracks': self.current_analysis['total_tracks'],
            'errors': self.current_analysis['errors'],
            'stats': self.analysis_stats
        }
    
    def analyze_track(self, audio_path, track_info):
        print(f"[AI] === Starting analysis for track: {track_info.get('title', 'Unknown')} ===")
        
        if not ML_AVAILABLE:
            raise Exception("ML libraries not available")
        
        track_key = f"{track_info['platform']}:{track_info['id']}"
        print(f"[AI] Track key: {track_key}")
        
        if track_key in self.embeddings_cache:
            print(f"[AI] Track already analyzed, returning cached result")
            return self.embeddings_cache[track_key]
        
        print(f"[AI] Loading CLAP model for new analysis...")
        self.load_model()
        
        try:
            print(f"[AI] Loading audio from: {audio_path}")
            audio, sr = librosa.load(audio_path, sr=48000, duration=30)
            print(f"[AI] Audio loaded: duration={len(audio)/sr:.1f}s, sr={sr}")
            
            if len(audio) < sr * 5:
                raise Exception("Track too short for analysis")
            
            print(f"[AI] Getting audio embedding...")
            audio_data = audio.astype(np.float32)
            audio_embed = self.model.get_audio_embedding_from_data(x=audio_data, use_tensor=False)
            print(f"[AI] Audio embedding shape: {audio_embed.shape}")
            
            if self.vocabulary_embeddings is not None:
                print(f"[AI] Vocabulary embeddings shape: {self.vocabulary_embeddings.shape}")
                print(f"[AI] Computing similarities...")
                similarities = np.dot(audio_embed[0], self.vocabulary_embeddings.T)
                print(f"[AI] Similarities shape: {similarities.shape}")
                print(f"[AI] Max similarity: {np.max(similarities):.3f}, Min similarity: {np.min(similarities):.3f}")
                
                top_indices = np.argsort(similarities)[-10:][::-1]
                print(f"[AI] Top 10 indices: {top_indices}")
                
                detected_tags = []
                for idx in top_indices:
                    tag = self.vocabulary[idx]
                    confidence = float(similarities[idx])
                    category = self.get_tag_category(tag)
                    detected_tags.append({
                        'tag': tag,
                        'confidence': confidence,
                        'category': category
                    })
                
                print(f"[AI] Top 10 tags for {track_info.get('title', 'Unknown')}:")
                for tag_data in detected_tags:
                    print(f"  - {tag_data['tag']} ({tag_data['category']}) - {tag_data['confidence']:.3f}")
                
                genres = [tag for tag in detected_tags if tag['category'] in ['genre_primary', 'subgenre']][:3]
                moods = [tag for tag in detected_tags if tag['category'] == 'mood'][:3]
                instruments = [tag for tag in detected_tags if tag['category'] == 'instrument'][:3]
                languages = [tag for tag in detected_tags if tag['category'] == 'language'][:1]
                
                print(f"[AI] Classified - Genres: {len(genres)}, Moods: {len(moods)}, Instruments: {len(instruments)}, Languages: {len(languages)}")
                if genres:
                    print(f"[AI] Genre tags: {[g['tag'] for g in genres]}")
                if moods:
                    print(f"[AI] Mood tags: {[m['tag'] for m in moods]}")
                if instruments:
                    print(f"[AI] Instrument tags: {[i['tag'] for i in instruments]}")
                if languages:
                    print(f"[AI] Language tags: {[l['tag'] for l in languages]}")
                
            else:
                print("[AI] Warning: vocabulary_embeddings is None")
                detected_tags = []
                genres = []
                moods = []
                instruments = []
                languages = []
            
            result = {
                'track_id': track_info['id'],
                'platform': track_info['platform'],
                'title': track_info.get('title', 'Unknown'),
                'detected_tags': detected_tags,
                'genres': genres,
                'moods': moods,
                'instruments': instruments,
                'languages': languages,
                'analyzed_at': time.time(),
                'duration': len(audio) / sr
            }
            
            print(f"[AI] Analysis complete for {track_info.get('title', 'Unknown')}")
            print(f"[AI] Result summary: {len(genres)} genres, {len(moods)} moods, {len(instruments)} instruments")
            
            self.embeddings_cache[track_key] = result
            return result
            
        except Exception as e:
            print(f"[AI] Analysis error for {track_key}: {e}")
            raise
    
    def get_tag_category(self, tag):
        try:
            vocabulary_file = os.path.join(os.path.dirname(__file__), 'music_tag_dictionary.json')
            with open(vocabulary_file, 'r', encoding='utf-8') as f:
                tag_dict = json.load(f)
            
            for category, tags in tag_dict.items():
                if tag in tags:
                    return category
            return 'unknown'
        except:
            return 'unknown'
    
    def extract_spectral_features(self, audio, sr):
        try:
            spectral_centroids = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
            spectral_rolloff = librosa.feature.spectral_rolloff(y=audio, sr=sr)[0]
            mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
            chroma = librosa.feature.chroma_stft(y=audio, sr=sr)
            
            tempo, beats = librosa.beat.beat_track(y=audio, sr=sr)
            
            return {
                'tempo': float(tempo),
                'spectral_centroid_mean': float(np.mean(spectral_centroids)),
                'spectral_centroid_std': float(np.std(spectral_centroids)),
                'spectral_rolloff_mean': float(np.mean(spectral_rolloff)),
                'mfcc_mean': np.mean(mfccs, axis=1).tolist(),
                'chroma_mean': np.mean(chroma, axis=1).tolist(),
                'energy': float(np.mean(librosa.feature.rms(y=audio)[0])),
                'zero_crossing_rate': float(np.mean(librosa.feature.zero_crossing_rate(audio)[0]))
            }
        except:
            return {}
    
    def build_user_profile_from_tracks(self, tracks_data):
        if not self.current_analysis['active']:
            return {'error': 'No active analysis session'}
        
        successful_analyses = 0
        errors = []
        
        for i, track in enumerate(tracks_data):
            try:
                self.current_analysis['progress'] = int((i / len(tracks_data)) * 100)
                self.current_analysis['current_track'] = track.get('title', 'Unknown')
                
                temp_file = self.download_track_for_analysis(track)
                if temp_file:
                    try:
                        result = self.analyze_track(temp_file, track)
                        successful_analyses += 1
                        print(f"[AI] Analyzed: {track.get('title', track['id'])}")
                    finally:
                        try:
                            os.remove(temp_file)
                        except:
                            pass
                else:
                    errors.append(f"Could not download: {track.get('title', track['id'])}")
                
            except Exception as e:
                error_msg = f"Error analyzing {track.get('title', track['id'])}: {str(e)}"
                errors.append(error_msg)
                print(f"[AI] {error_msg}")
        
        self.current_analysis['errors'] = errors
        
        if successful_analyses > 0:
            self.build_user_profile()
            self.analysis_stats['tracks_analyzed'] += successful_analyses
            self.analysis_stats['analysis_sessions'] += 1
            self.analysis_stats['last_analysis'] = time.time()
            self.analysis_stats['profile_strength'] = min(100, (successful_analyses / 10) * 100)
        
        self.save_data()
        
        return {
            'success': True,
            'analyzed': successful_analyses,
            'total': len(tracks_data),
            'errors': len(errors),
            'profile_strength': self.analysis_stats['profile_strength']
        }
    
    def build_user_profile(self):
        if not self.embeddings_cache:
            return
        
        all_genres = []
        all_moods = []
        all_instruments = []
        all_languages = []
        
        for track_data in self.embeddings_cache.values():
            all_genres.extend([g['tag'] for g in track_data.get('genres', [])])
            all_moods.extend([m['tag'] for m in track_data.get('moods', [])])
            all_instruments.extend([i['tag'] for i in track_data.get('instruments', [])])
            all_languages.extend([l['tag'] for l in track_data.get('languages', [])])
        
        from collections import Counter
        
        self.user_profile = {
            'top_genres': dict(Counter(all_genres).most_common(10)),
            'top_moods': dict(Counter(all_moods).most_common(10)),
            'top_instruments': dict(Counter(all_instruments).most_common(10)),
            'languages': dict(Counter(all_languages).most_common(5)),
            'updated_at': time.time(),
            'tracks_count': len(self.embeddings_cache)
        }
    
    def download_track_for_analysis(self, track):
        try:
            import requests
            import youtube_services
            import soundcloud_services
            
            if track['platform'] == 'youtube':
                with youtube_services.youtube_cache_lock:
                    cached = youtube_services.youtube_url_cache.get(track['id'])
                    if cached and 'url' in cached:
                        stream_url = cached['url']
                    else:
                        return None
            
            elif track['platform'] == 'soundcloud':
                stream_url = f"http://localhost:5000/api/stream/soundcloud?id={track['id']}"
            
            else:
                return None
            
            temp_file = tempfile.NamedTemporaryFile(suffix='.m4a', delete=False)
            temp_file.close()
            
            response = requests.get(stream_url, stream=True, timeout=60)
            if response.status_code == 200:
                with open(temp_file.name, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                return temp_file.name
            
        except Exception as e:
            print(f"[AI] Download error: {e}")
        
        return None
    
    def start_analysis(self):
        self.current_analysis['active'] = True
        self.current_analysis['progress'] = 0
        self.current_analysis['current_track'] = None
        self.current_analysis['total_tracks'] = 0
        self.current_analysis['errors'] = []
    
    def stop_analysis(self):
        self.current_analysis['active'] = False


analyzer_instance = None
analyzer_lock = Lock()

def get_analyzer(user_data_dir):
    global analyzer_instance
    with analyzer_lock:
        if not analyzer_instance:
            analyzer_instance = AudioAnalyzer(user_data_dir)
        return analyzer_instance

def setup_analysis_routes(app, user_data_dir, load_playlists_func):
    
    @app.route('/api/ai/status', methods=['GET'])
    def get_ai_status():
        return jsonify({
            'ml_available': ML_AVAILABLE,
            'libraries': {
                'openl3': 'openl3' in globals(),
                'librosa': 'librosa' in globals()
            }
        })
    
    @app.route('/api/ai/analysis/status', methods=['GET'])
    def get_analysis_status():
        analyzer = get_analyzer(user_data_dir)
        return jsonify(analyzer.get_analysis_status())
    
    @app.route('/api/ai/analysis/start', methods=['POST'])
    def start_profile_analysis():
        if not ML_AVAILABLE:
            return jsonify({'error': 'ML libraries not available'}), 400
        
        try:
            analyzer = get_analyzer(user_data_dir)
            
            if analyzer.current_analysis['active']:
                return jsonify({'error': 'Analysis already in progress'}), 400
            
            playlists_data = load_playlists_func()
            
            all_tracks = []
            
            for track in playlists_data.get('liked_tracks', []):
                if track.get('platform') in ['youtube', 'soundcloud']:
                    all_tracks.append(track)
            
            for playlist in playlists_data.get('playlists', []):
                for track in playlist.get('tracks', []):
                    if track.get('platform') in ['youtube', 'soundcloud']:
                        track_key = f"{track['platform']}:{track['id']}"
                        if not any(f"{t['platform']}:{t['id']}" == track_key for t in all_tracks):
                            all_tracks.append(track)
            
            if not all_tracks:
                return jsonify({'error': 'No tracks found for analysis'}), 400
            
            analyzer.start_analysis()
            analyzer.current_analysis['total_tracks'] = len(all_tracks)
            
            def run_analysis():
                try:
                    analyzer.build_user_profile_from_tracks(all_tracks)
                finally:
                    analyzer.stop_analysis()
            
            threading.Thread(target=run_analysis, daemon=True).start()
            
            return jsonify({
                'success': True,
                'tracks_to_analyze': len(all_tracks),
                'message': 'Analysis started'
            })
        
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/ai/analysis/stop', methods=['POST'])
    def stop_profile_analysis():
        analyzer = get_analyzer(user_data_dir)
        analyzer.stop_analysis()
        return jsonify({'success': True})
    
    @app.route('/api/ai/profile', methods=['GET'])
    def get_user_profile():
        analyzer = get_analyzer(user_data_dir)
        return jsonify({
            'profile': analyzer.user_profile,
            'stats': analyzer.analysis_stats,
            'tracks_analyzed': len(analyzer.embeddings_cache)
        })
    
    return app