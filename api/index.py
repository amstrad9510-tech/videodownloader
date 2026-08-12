import hashlib
import hmac
import json
import os
import re
import shutil
import sys
import subprocess
import tempfile
import urllib.parse
from http.server import BaseHTTPRequestHandler
import yt_dlp

# Use /tmp directory for writable caching in Vercel Serverless environment
CACHE_DIR = os.path.join(tempfile.gettempdir(), 'downloads_cache')
if not os.path.exists(CACHE_DIR):
    try:
        os.makedirs(CACHE_DIR, exist_ok=True)
    except Exception:
        pass

SERVER_SALT = b'vercel_youtube_downloader_secret_salt'

def get_cache_key(url, fmt):
    fmt_key = (fmt or 'best').lower().strip().replace(' ', '_')
    key = hmac.new(SERVER_SALT, f"{url}_{fmt_key}".encode('utf-8'), hashlib.sha256).hexdigest()[:16]
    return f"{key}_{fmt_key}"

def get_ffmpeg_path():
    path = shutil.which('ffmpeg')
    if path:
        return path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    return None

FFMPEG_PATH = get_ffmpeg_path()

def sanitize_ascii(text, default="download_file"):
    if not text:
        return default
    cleaned = text.encode('ascii', 'ignore').decode('ascii')
    cleaned = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', cleaned)
    cleaned = re.sub(r'_+', '_', cleaned).strip('_')
    return cleaned if cleaned else default

class handler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def serve_file(self, filepath, is_audio=False):
        file_size = os.path.getsize(filepath)
        raw_filename = os.path.basename(filepath)
        clean_filename = re.sub(r'^[a-f0-9]{16}_[^_]+_', '', raw_filename)
        
        filename_base, filename_ext = os.path.splitext(clean_filename)
        if is_audio:
            filename_ext = '.mp3'
            clean_filename = f"{filename_base}.mp3"
        elif not filename_ext or filename_ext.lower() not in ['.mp4', '.mkv', '.webm']:
            filename_ext = '.mp4'
            clean_filename = f"{filename_base}.mp4"

        safe_ascii_name = f"{sanitize_ascii(filename_base)}{filename_ext}"
        percent_encoded_name = urllib.parse.quote(clean_filename)
        content_type = 'audio/mpeg' if is_audio else 'video/mp4'

        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(file_size))
        self.send_header('Content-Disposition', f'attachment; filename="{safe_ascii_name}"; filename*=UTF-8\'\'{percent_encoded_name}')
        self.end_headers()

        with open(filepath, 'rb') as f:
            while True:
                chunk = f.read(64 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)

    def send_json_response(self, data, code=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json_error(self, message, code=400):
        self.send_json_response({'error': message, 'status': 'error'}, code)

    def extract_info(self, url):
        clean_url = url.strip()
        oembed_title = ''
        oembed_author = ''
        oembed_thumb = ''
        video_id = ''

        yt_match = re.search(r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})', clean_url, re.I)
        if yt_match and yt_match.group(1):
            video_id = yt_match.group(1)

        try:
            oembed_req_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(clean_url)}&format=json"
            req = urllib.request.Request(oembed_req_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode('utf-8'))
                    oembed_title = data.get('title') or ''
                    oembed_author = data.get('author_name') or ''
                    oembed_thumb = data.get('thumbnail_url') or ''
        except Exception:
            pass

        node_exe = shutil.which('node')
        ydl_opts = {
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios', 'web']
                }
            }
        }
        if node_exe:
            ydl_opts['js_runtimes'] = {'node': {'path': node_exe}}
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                meta = ydl.extract_info(clean_url, download=False)
                title = oembed_title or meta.get('title') or 'Video'
                uploader = oembed_author or meta.get('uploader') or meta.get('uploader_id') or meta.get('channel') or 'Creator'
                duration = meta.get('duration') or 180
                thumbnail = oembed_thumb or meta.get('thumbnail') or (f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else "")
                view_count = meta.get('view_count') or 0
                extractor = meta.get('extractor') or 'youtube'
                vid_id = meta.get('id') or video_id

                minutes, seconds = divmod(int(duration), 60)
                hours, minutes = divmod(minutes, 60)
                duration_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}" if hours > 0 else f"{minutes:02d}:{seconds:02d}"

                if view_count >= 1000000:
                    views_str = f"{view_count / 1000000:.1f}M views"
                elif view_count >= 1000:
                    views_str = f"{view_count / 1000:.1f}K views"
                elif view_count > 0:
                    views_str = f"{view_count} views"
                else:
                    views_str = "HD Video Stream"

                format_sizes = {}
                if 'formats' in meta and isinstance(meta['formats'], list):
                    audio_sizes = [f.get('filesize') or f.get('filesize_approx') or 0 for f in meta['formats'] if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
                    best_audio_mb = round((max(audio_sizes) if audio_sizes else 0) / (1024 * 1024), 1)
                    height_map = {}
                    for f in meta['formats']:
                        h = f.get('height')
                        vcodec = f.get('vcodec')
                        fsize = f.get('filesize') or f.get('filesize_approx')
                        if h and fsize and vcodec != 'none':
                            if h not in height_map or fsize > height_map[h]:
                                height_map[h] = fsize
                    for h, fsize in height_map.items():
                        mb = round((fsize / (1024 * 1024)) + best_audio_mb, 1)
                        if h >= 2160: format_sizes['2160p'] = max(format_sizes.get('2160p', 0), mb)
                        elif h >= 1440: format_sizes['1440p'] = max(format_sizes.get('1440p', 0), mb)
                        elif h >= 1080: format_sizes['1080p'] = max(format_sizes.get('1080p', 0), mb)
                        elif h >= 720: format_sizes['720p'] = max(format_sizes.get('720p', 0), mb)
                        elif h >= 480: format_sizes['480p'] = max(format_sizes.get('480p', 0), mb)
                        elif h >= 360: format_sizes['360p'] = max(format_sizes.get('360p', 0), mb)

                embed_iframe_url = f"https://www.youtube-nocookie.com/embed/{vid_id}?autoplay=0&rel=0" if vid_id else ""
                return {
                    'title': title,
                    'author': uploader,
                    'durationSec': duration,
                    'durationStr': duration_str,
                    'thumbnail': thumbnail,
                    'viewsStr': views_str,
                    'extractor': extractor,
                    'formatSizes': format_sizes,
                    'videoId': vid_id,
                    'embedIframeUrl': embed_iframe_url,
                    'url': clean_url
                }
        except Exception as err:
            thumb_url = oembed_thumb or (f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else "")
            embed_url = f"https://www.youtube-nocookie.com/embed/{video_id}?autoplay=0&rel=0" if video_id else ""
            return {
                'title': oembed_title or 'YouTube Video',
                'author': oembed_author or 'YouTube Creator',
                'durationSec': 1800,
                'durationStr': 'Full Video',
                'thumbnail': thumb_url,
                'viewsStr': 'YouTube HD Video',
                'extractor': 'youtube',
                'videoId': video_id,
                'embedIframeUrl': embed_url,
                'url': clean_url,
                'isFallback': True
            }

    def handle_media_download(self, url, fmt):
        cache_key = get_cache_key(url, fmt)
        fmt_lower = (fmt or '').lower()
        is_audio = 'mp3' in fmt_lower or 'audio' in fmt_lower

        if os.path.exists(CACHE_DIR):
            cached_files = [f for f in os.listdir(CACHE_DIR) if f.startswith(cache_key)]
            if cached_files:
                cached_filepath = os.path.join(CACHE_DIR, cached_files[0])
                self.serve_file(cached_filepath, is_audio=is_audio)
                return

        ffmpeg_path = FFMPEG_PATH or get_ffmpeg_path()
        target_height = 0
        if '2160p' in fmt_lower or '4k' in fmt_lower: target_height = 2160
        elif '1440p' in fmt_lower or '2k' in fmt_lower: target_height = 1440
        elif '1080p' in fmt_lower: target_height = 1080
        elif '720p' in fmt_lower: target_height = 720
        elif '480p' in fmt_lower: target_height = 480
        elif '360p' in fmt_lower: target_height = 360

        with tempfile.TemporaryDirectory() as tmpdir:
            out_tmpl = os.path.join(tmpdir, '%(title)s.%(ext)s')
            format_spec = 'bestaudio/best' if is_audio else (f'best[height<={target_height}]/bestvideo[height<={target_height}]+bestaudio/best' if target_height > 0 else 'bestvideo+bestaudio/best')

            ydl_opts = {
                'outtmpl': out_tmpl,
                'quiet': True,
                'no_warnings': True,
                'format': format_spec,
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android_vr', 'tv_embedded', 'android', 'web']
                    }
                },
                'socket_timeout': 15,
                'retries': 3,
                'fragment_retries': 3,
            }
            if ffmpeg_path:
                ydl_opts['ffmpeg_location'] = ffmpeg_path
                if not is_audio:
                    ydl_opts['merge_output_format'] = 'mp4'

            if is_audio:
                ydl_opts['postprocessors'] = [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }]

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            downloaded = [os.path.join(tmpdir, f) for f in os.listdir(tmpdir) if os.path.isfile(os.path.join(tmpdir, f))]
            if not downloaded:
                raise Exception("Media file was not generated by downloader")
            dl_file = downloaded[0]

            orig_ext = os.path.splitext(dl_file)[1] or ('.mp3' if is_audio else '.mp4')
            cached_filename = f"{cache_key}{orig_ext}"
            final_cached_path = os.path.join(CACHE_DIR, cached_filename)
            try:
                shutil.copy2(dl_file, final_cached_path)
            except Exception:
                pass

            self.serve_file(dl_file, is_audio=is_audio)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed_url.query)

        if parsed_url.path == '/api/info':
            video_url = query.get('url', [''])[0]
            if not video_url:
                self.send_json_error("Missing 'url' parameter", 400)
                return
            info = self.extract_info(video_url)
            self.send_json_response(info)
            return

        elif parsed_url.path == '/api/download':
            video_url = query.get('url', [''])[0]
            fmt = query.get('format', ['best'])[0].lower()
            if not video_url:
                self.send_json_error("Missing 'url' parameter", 400)
                return
            try:
                self.handle_media_download(video_url, fmt)
            except Exception as e:
                self.send_json_error(f"Download failed: {str(e)}", 500)
            return

        self.send_json_error("Not found", 404)
