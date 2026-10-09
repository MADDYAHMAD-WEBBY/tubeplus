import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { extractVideoId } from '../../utils/youtube';

export const dynamic = 'force-static';

function runYtDlp(targetUrl: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const binaryPath = 'C:\\Users\\Hammad\\yt-dlp.exe';
    const nodePath = 'C:\\Users\\Hammad\\nodejs\\node.exe';

    const args = [
      '--js-runtimes', `node:${nodePath}`,
      '-j',
      '--',
      targetUrl
    ];
    
    execFile(binaryPath, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url') || searchParams.get('v') || searchParams.get('id');
  const videoId = extractVideoId(target || '');

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid or missing YouTube Video URL/ID' }, { status: 400 });
  }

  try {
    const isShort = target?.includes('/shorts/') || false;
    const fullUrl = isShort 
      ? `https://www.youtube.com/shorts/${videoId}` 
      : `https://www.youtube.com/watch?v=${videoId}`;

    const manifest: any = await runYtDlp(fullUrl);

    if (!manifest || !manifest.formats) {
      throw new Error('yt-dlp returned no streaming formats');
    }

    const formats: any[] = [];
    const videoByHeight = new Map<number, any>();
    const audioFormats: any[] = [];

    for (const f of manifest.formats) {
      if (!f.url || !f.url.includes('googlevideo.com')) continue;

      const isAudioOnly = f.vcodec === 'none' && f.acodec !== 'none';
      const isVideoOnly = f.vcodec !== 'none' && f.acodec === 'none';
      const isCombo = f.vcodec !== 'none' && f.acodec !== 'none';

      if (isAudioOnly) {
        audioFormats.push({
          itag: f.format_id || Math.floor(Math.random() * 10000),
          url: f.url,
          qualityLabel: `${Math.round(f.abr || f.tbr || 128)} kbps (High Quality Audio)`,
          mimeType: f.ext ? `audio/${f.ext}` : 'audio/mp4',
          container: f.ext || 'm4a',
          contentLength: f.filesize || f.filesize_approx || null,
          bitrate: f.tbr ? Math.round(f.tbr * 1000) : 0,
          type: 'audioonly',
          hasAudio: true,
          hasVideo: false
        });
      } else if (f.height) {
        const height = f.height;
        const fps = f.fps || 30;
        const key = height * 100 + (fps > 30 ? 60 : 30);

        const existing = videoByHeight.get(key);
        const filesize = f.filesize || f.filesize_approx || 0;
        const existingSize = existing ? (existing.contentLength || 0) : 0;

        // Prefer mp4 container or larger bitrate/filesize
        if (!existing || f.ext === 'mp4' || filesize > existingSize) {
          let label = `${height}p`;
          if (height >= 2160) label = '4K 2160p';
          else if (height >= 1440) label = '2K 1440p';
          else if (height === 1080) label = '1080p Full HD';
          else if (height === 720) label = '720p HD';

          if (fps > 30) {
            label += ` (${fps}fps)`;
          }

          videoByHeight.set(key, {
            itag: f.format_id || Math.floor(Math.random() * 10000),
            url: f.url,
            qualityLabel: label,
            mimeType: f.ext ? `video/${f.ext}` : 'video/mp4',
            container: f.ext || 'mp4',
            contentLength: filesize || null,
            bitrate: f.tbr ? Math.round(f.tbr * 1000) : 0,
            width: f.width || null,
            height,
            fps,
            type: isCombo ? 'progressive' : 'videoonly',
            hasAudio: isCombo,
            hasVideo: true
          });
        }
      }
    }

    // Sort video formats by height descending
    const sortedVideo = Array.from(videoByHeight.values()).sort((a, b) => {
      if (b.height !== a.height) return b.height - a.height;
      return (b.fps || 0) - (a.fps || 0);
    });

    // Select top audio format
    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const topAudio = audioFormats.slice(0, 2);

    formats.push(...sortedVideo, ...topAudio);

    return NextResponse.json({
      id: manifest.id || videoId,
      title: manifest.title || 'YouTube Video',
      channel: manifest.uploader || manifest.channel || 'YouTube Creator',
      durationSeconds: manifest.duration || 0,
      views: manifest.view_count || '0',
      thumbnail: manifest.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      formats
    });
  } catch (ytDlpErr: any) {
    return NextResponse.json(
      { error: 'Failed to extract streaming data from YouTube.', details: ytDlpErr.message },
      { status: 422 }
    );
  }
}
