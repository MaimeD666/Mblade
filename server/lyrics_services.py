import os
import json
import requests
import re
import time
from bs4 import BeautifulSoup

GENIUS_API_TOKEN = "rDpcN6GuTthCj8QVXez4dzFH50NuXKcBzVFRm2p9DHTVi0cTXy0b3J4YBfbR2g4M"
GENIUS_BASE_URL = "https://api.genius.com"
GENIUS_HEADERS = {
    "Authorization": f"Bearer {GENIUS_API_TOKEN}",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}

lyrics_cache = {}
search_cache = {}

def clean_title_for_search(title):
    title = re.sub(r'\(feat\..*?\)|\(ft\..*?\)|\(featuring.*?\)', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\(official.*?\)|\(lyric.*?\)|\(audio.*?\)|\(video.*?\)|\(music.*?\)', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\[.*?\]|\(.*remix.*\)|\(.*edit.*\)', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\s+', ' ', title).strip()
    return title

def extract_artist_from_title(title):
    patterns = [
        r'^([^-–—]+?)\s*[-–—]\s*(.+)$',
        r'^([^|]+?)\s*\|\s*(.+)$',
        r'^([^:]+?):\s*(.+)$',
        r'^(.+?)\s+by\s+(.+)$',
        r'^(.+?)\s+-\s+(.+)$',
        r'(.+?)\s*\(\s*(.+?)\s*\)',
        r'^(.+?)\s*•\s*(.+)$'
    ]
    
    for pattern in patterns:
        match = re.match(pattern, title.strip(), re.IGNORECASE)
        if match:
            potential_artist = match.group(1).strip()
            song_title = match.group(2).strip()
            
            if len(potential_artist) < 50 and len(song_title) > 0 and potential_artist.lower() != song_title.lower():
                return potential_artist, song_title
    
    return None, title

def calculate_relevance_score(search_title, search_artist, result_title, result_artist):
    score = 0
    
    search_title_clean = clean_title_for_search(search_title).lower()
    result_title_clean = result_title.lower()
    result_artist_clean = result_artist.lower() if result_artist else ""
    
    title_words = search_title_clean.split()
    title_matches = sum(1 for word in title_words if len(word) > 2 and word in result_title_clean)
    title_ratio = title_matches / len([w for w in title_words if len(w) > 2]) if title_words else 0
    score += title_ratio * 70
    
    if search_artist:
        search_artist_clean = search_artist.lower()
        search_artist_words = search_artist_clean.split()
        
        if search_artist_clean in result_artist_clean or result_artist_clean in search_artist_clean:
            score += 40
        elif any(word in result_artist_clean for word in search_artist_words if len(word) > 2):
            artist_matches = sum(1 for word in search_artist_words if len(word) > 2 and word in result_artist_clean)
            score += (artist_matches / max(1, len([w for w in search_artist_words if len(w) > 2]))) * 30
    
    popular_artists = ['кишлак', 'молли', 'платон', 'скриптонит', 'face', 'pharaoh', 'тима', 'белый', 'лсп', 'miyagi', 'endspiel']
    if search_artist and any(artist in search_artist_clean for artist in popular_artists):
        if any(artist in result_artist_clean for artist in popular_artists):
            score += 20
    
    if 'translation' in result_title_clean or 'перевод' in result_title_clean or 'lyrics' in result_title_clean.split():
        score -= 25
    
    if 'remix' in result_title_clean or 'edit' in result_title_clean or 'cover' in result_title_clean:
        score -= 15
    
    if len(result_title_clean) > 120:
        score -= 15
    
    if result_title_clean == search_title_clean:
        score += 10
    
    return score

def search_genius_songs(title, artist=None):
    try:
        cache_key = f"{title}:{artist or ''}"
        if cache_key in search_cache:
            cached_result = search_cache[cache_key]
            if time.time() - cached_result.get('timestamp', 0) < 3600:
                return cached_result['data']
        
        extracted_artist, clean_title = extract_artist_from_title(title)
        if not artist and extracted_artist:
            artist = extracted_artist
            title = clean_title
        elif artist and extracted_artist and extracted_artist.lower() not in artist.lower():
            artist = extracted_artist
            title = clean_title
        
        clean_search_title = clean_title_for_search(title if not extracted_artist else clean_title)
        
        search_queries = []
        if artist and clean_search_title:
            search_queries.extend([
                f"{artist} {clean_search_title}",
                f"{clean_search_title} {artist}",
                f'"{artist}" "{clean_search_title}"'
            ])
        
        search_queries.append(clean_search_title)
        
        if artist:
            search_queries.append(artist)
        
        search_queries = list(dict.fromkeys(search_queries))
        
        all_results = []
        seen_urls = set()
        
        for query in search_queries[:3]:
            print(f"[Lyrics] Searching: '{query}'")
            
            url = f"{GENIUS_BASE_URL}/search"
            params = {"q": query}
            
            response = requests.get(url, headers=GENIUS_HEADERS, params=params, timeout=10)
            
            if response.status_code != 200:
                continue
                
            data = response.json()
            hits = data.get("response", {}).get("hits", [])
            
            for hit in hits[:8]:
                result = hit.get("result", {})
                song_url = result.get("url", "")
                
                if not song_url or 'genius.com' not in song_url or song_url in seen_urls:
                    continue
                
                seen_urls.add(song_url)
                
                result_title = result.get("title", "")
                result_artist = result.get("primary_artist", {}).get("name", "")
                
                relevance = calculate_relevance_score(
                    title, artist, result_title, result_artist
                )
                
                song_info = {
                    "id": result.get("id"),
                    "title": result_title,
                    "artist": result_artist,
                    "url": song_url,
                    "album_art": result.get("song_art_image_url"),
                    "relevance_score": relevance
                }
                
                all_results.append(song_info)
        
        all_results.sort(key=lambda x: x['relevance_score'], reverse=True)
        
        search_cache[cache_key] = {
            "data": all_results[:5],
            "timestamp": time.time()
        }
        
        return all_results[:5]
        
    except Exception as e:
        print(f"[Lyrics] Search error: {e}")
        return []

def clean_lyrics_text(text):
    if not text:
        return ""
    
    lines = text.split('\n')
    cleaned_lines = []
    
    skip_patterns = [
        r'^\d+\s+contributors?$',
        r'^translations?$',
        r'^romanization$',
        r'^embed$',
        r'^cancel$',
        r'^how to format lyrics:?$',
        r'^type out all lyrics',
        r'^lyrics should be broken',
        r'^use section headers',
        r'^use.*italics',
        r'^if you don.*understand',
        r'^to learn more',
        r'^transcription guide',
        r'^transcribers forum',
        r'^\s*$',
        r'^you might also like$',
        r'^see.*live$',
        r'^get tickets$',
        r'^genius.*annotation',
        r'^verified by genius',
        r'^produced by',
        r'^written by',
        r'^release date',
        r'^tags$',
        r'^.*translation.*lyrics$',
        r'^.*english translation.*$'
    ]
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        line_lower = line.lower()
        
        should_skip = False
        for pattern in skip_patterns:
            if re.match(pattern, line_lower):
                should_skip = True
                break
        
        if should_skip:
            continue
            
        if len(line) > 200:
            continue
            
        if line.count(' ') < 1 and not re.match(r'^\[.*\]$', line):
            continue
            
        cleaned_lines.append(line)
    
    result = '\n'.join(cleaned_lines)
    result = re.sub(r'\n{3,}', '\n\n', result)
    result = re.sub(r'^\s+|\s+$', '', result, flags=re.MULTILINE)
    
    return result.strip()

def scrape_genius_lyrics(song_url):
    try:
        print(f"[Lyrics] Scraping: {song_url}")
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        }
        
        response = requests.get(song_url, headers=headers, timeout=15)
        if response.status_code != 200:
            print(f"[Lyrics] HTTP error: {response.status_code}")
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        for element in soup.find_all(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            element.decompose()
        
        for element in soup.find_all(attrs={'class': re.compile(r'(navigation|header|footer|sidebar|menu|ad|banner|social|share|comment)')}):
            element.decompose()
        
        lyrics_containers = soup.find_all('div', {'data-lyrics-container': 'true'})
        
        if lyrics_containers:
            print(f"[Lyrics] Found {len(lyrics_containers)} lyrics containers")
            lyrics_text = ""
            
            for container in lyrics_containers:
                for br in container.find_all("br"):
                    br.replace_with("\n")
                
                for unwanted in container.find_all(['a', 'span'], class_=re.compile(r'(reference|annotation|note|link)')):
                    unwanted.decompose()
                
                container_text = container.get_text(separator='\n')
                if container_text.strip():
                    lyrics_text += container_text + "\n"
            
            cleaned_lyrics = clean_lyrics_text(lyrics_text)
            
            if cleaned_lyrics and len(cleaned_lyrics) > 100:
                print(f"[Lyrics] Successfully extracted {len(cleaned_lyrics)} characters")
                return cleaned_lyrics
        
        print("[Lyrics] No clean lyrics found on page")
        return None
        
    except Exception as e:
        print(f"[Lyrics] Scrape error: {e}")
        return None

def get_lyrics(title, artist=None):
    cache_key = f"{title}:{artist or ''}".lower().strip()
    
    if cache_key in lyrics_cache:
        cached_result = lyrics_cache[cache_key] 
        if time.time() - cached_result.get('timestamp', 0) < 7200:
            print(f"[Lyrics] Using cached result for '{title}'")
            return cached_result['data']
    
    try:
        print(f"[Lyrics] Getting lyrics for: '{title}' by {artist or 'Unknown'}")
        
        search_results = search_genius_songs(title, artist)
        if not search_results:
            result = {"success": False, "message": "Song not found"}
            lyrics_cache[cache_key] = {"data": result, "timestamp": time.time()}
            return result
        
        best_match = search_results[0]
        song_url = best_match.get("url")
        
        if not song_url:
            result = {"success": False, "message": "Song URL not found"}
            lyrics_cache[cache_key] = {"data": result, "timestamp": time.time()}
            return result
        
        lyrics = scrape_genius_lyrics(song_url)
        
        if lyrics and len(lyrics) > 50:
            result = {
                "success": True,
                "lyrics": lyrics,
                "title": best_match.get("title", title),
                "artist": best_match.get("artist", artist or "Unknown"),
                "genius_url": song_url,
                "album_art": best_match.get("album_art"),
                "source": "genius",
                "relevance_score": best_match.get("relevance_score", 0),
                "alternatives": search_results[1:4] if len(search_results) > 1 else []
            }
            lyrics_cache[cache_key] = {"data": result, "timestamp": time.time()}
            print(f"[Lyrics] Successfully got lyrics for '{title}' (score: {best_match.get('relevance_score', 0):.1f})")
            return result
        else:
            result = {"success": False, "message": "Lyrics not found or too short", "alternatives": search_results[:3]}
            lyrics_cache[cache_key] = {"data": result, "timestamp": time.time()}
            return result
            
    except Exception as e:
        print(f"[Lyrics] Error getting lyrics: {e}")
        result = {"success": False, "error": str(e)}
        return result

def get_lyrics_by_url(song_url):
    try:
        print(f"[Lyrics] Getting lyrics by URL: {song_url}")
        
        lyrics = scrape_genius_lyrics(song_url)
        
        if lyrics and len(lyrics) > 50:
            return {
                "success": True,
                "lyrics": lyrics,
                "source": "genius",
                "genius_url": song_url
            }
        else:
            return {"success": False, "message": "Lyrics not found"}
            
    except Exception as e:
        print(f"[Lyrics] Error getting lyrics by URL: {e}")
        return {"success": False, "error": str(e)}