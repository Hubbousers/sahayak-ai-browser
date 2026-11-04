export interface YouTubeMetadata {
  videoId: string;
  title: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
}

export interface YouTubeContent {
  videoId: string;
  title: string;
  transcript: string;
  hasTranscript: boolean;
  author?: string;
}

/**
 * Extracts standard 11-character video ID from common YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 */
export function parseYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1].split('/')[0];
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1].split('/')[0];
      }
    }
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('?')[0];
    }
  } catch {
    // Check with regex fallback
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Validates if the video is publicly accessible and fetches video metadata via public oEmbed API
 */
export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeMetadata> {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(oEmbedUrl);
  if (!res.ok) {
    if (res.status === 404 || res.status === 401 || res.status === 403) {
      throw new Error('Unsupported or private YouTube link. Video must be public and accessible.');
    }
    throw new Error(`Failed to load video metadata: HTTP ${res.status}`);
  }
  const data = await res.json();
  return {
    videoId,
    title: data.title || 'YouTube Video',
    author_name: data.author_name,
    author_url: data.author_url,
    thumbnail_url: data.thumbnail_url
  };
}

/**
 * Fetches public caption/transcript text from YouTube timedtext endpoint
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  // Strategy 1: Fetch timedtext track list directly
  const timedTextTracksUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
  try {
    const listRes = await fetch(timedTextTracksUrl);
    if (listRes.ok) {
      const listXml = await listRes.text();
      // Look for lang_code="en" or first available track
      const match = listXml.match(/lang_code="([^"]+)"/);
      const langCode = match ? match[1] : 'en';

      const transcriptUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}&fmt=json3`;
      const transRes = await fetch(transcriptUrl);
      if (transRes.ok) {
        const json = await transRes.json();
        if (json.events && Array.isArray(json.events)) {
          const lines = json.events
            .map((evt: any) => {
              const startSec = Math.floor((evt.tStartMs || 0) / 1000);
              const text = (evt.segs || []).map((s: any) => s.utf8 || '').join('').trim();
              return text ? `[${startSec}s] ${text}` : '';
            })
            .filter((l: string) => l.length > 0)
            .join('\n');

          if (lines.length > 50) {
            return lines;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Timedtext fetch warning:', err);
  }

  return null;
}

/**
 * Extracts public YouTube content, returning metadata and transcript lines with timestamp cues
 */
export async function extractYouTube(url: string): Promise<YouTubeContent> {
  const videoId = parseYouTubeVideoId(url);
  if (!videoId) {
    throw new Error('Invalid or unsupported YouTube link.');
  }

  const meta = await fetchYouTubeMetadata(videoId);
  const transcript = await fetchYouTubeTranscript(videoId);

  return {
    videoId,
    title: meta.title,
    transcript: transcript || '',
    hasTranscript: !!transcript && transcript.length > 0,
    author: meta.author_name
  };
}
