import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { extractVideoId } from '../../utils/youtube';

export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url') || searchParams.get('v') || searchParams.get('id');
  const title = searchParams.get('title') || 'video';
  const quality = searchParams.get('quality') || '1080';
  const itag = searchParams.get('itag');

  const videoId = extractVideoId(target || '');

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid or missing YouTube Video URL/ID' }, { status: 400 });
  }

  try {
    const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `${safeTitle} [${quality}p].mp4`;
    const tempFileId = `merged_${videoId}_${quality}_${Date.now()}.mp4`;
    const tempFilePath = path.join(os.tmpdir(), tempFileId);
    
    const isShort = target?.includes('/shorts/') || false;
    const fullUrl = isShort 
      ? `https://www.youtube.com/shorts/${videoId}` 
      : `https://www.youtube.com/watch?v=${videoId}`;

    const binaryPath = 'C:\\Users\\Hammad\\yt-dlp.exe';
    const ffmpegPath = 'C:\\Users\\Hammad\\ffmpeg.exe';
    const nodePath = 'C:\\Users\\Hammad\\nodejs\\node.exe';

    const formatSpec = itag
      ? `${itag}+bestaudio/bestvideo[height<=${quality}]+bestaudio/best`
      : `bestvideo[height<=${quality}]+bestaudio/bestvideo+bestaudio/best`;

    await new Promise((resolve, reject) => {
      execFile(
        binaryPath,
        [
          '--js-runtimes', `node:${nodePath}`,
          '--ffmpeg-location', ffmpegPath,
          '-f', formatSpec,
          '--merge-output-format', 'mp4',
          '--postprocessor-args', 'ffmpeg:-c:v copy -c:a aac -b:a 192k',
          '-o', tempFilePath,
          '--', fullUrl
        ],
        { maxBuffer: 20 * 1024 * 1024 },
        (err) => {
          if (err) return reject(err);
          resolve(true);
        }
      );
    });

    if (!fs.existsSync(tempFilePath)) {
      throw new Error('Pre-merged output file was not created');
    }

    const downloadReadyUrl = `/api/download-file?file=${encodeURIComponent(tempFileId)}&name=${encodeURIComponent(filename)}`;

    return NextResponse.json({
      success: true,
      readyUrl: downloadReadyUrl,
      filename
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Pre-merge failed' }, { status: 500 });
  }
}
