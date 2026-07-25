import base64
import os

mp4_path = 'mp4_base64.txt'
mp3_path = 'mp3_base64.txt'

if os.path.exists(mp4_path) and os.path.exists(mp3_path):
    with open(mp4_path, 'r', encoding='utf-8') as f:
        mp4_b64 = f.read().strip()

    with open(mp3_path, 'r', encoding='utf-8') as f:
        mp3_full = f.read().strip()
        # Take 500KB chunk of MP3 base64 (~375KB valid MP3 audio stream)
        mp3_b64 = mp3_full[:500000]

    js_code = f"""/**
 * Embedded Genuine Media Samples Engine
 * Provides 100% valid MP4 H.264 Video and MPEG MP3 Audio buffers
 */

export const GENUINE_MP4_BASE64 = "{mp4_b64}";
export const GENUINE_MP3_BASE64 = "{mp3_b64}";

export function base64ToBlob(base64, mimeType) {{
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {{
    bytes[i] = binaryString.charCodeAt(i);
  }}
  return new Blob([bytes], {{ type: mimeType }});
}}
"""

    with open('js/modules/media_data.js', 'w', encoding='utf-8') as f:
        f.write(js_code)
    print("SUCCESSFULLY_CREATED_JS_MEDIA_DATA")
else:
    print("MISSING_BASE64_FILES")
