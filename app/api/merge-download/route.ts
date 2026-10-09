import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
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
    const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const binaryPath = 'C:\\Users\\Hammad\\yt-dlp.exe';

    // Format selection string: if specific itag is provided use itag+bestaudio, else height format
    const formatSpec = itag
      ? `${itag}+bestaudio/best`
      : `bestvideo[height<=${quality}]+bestaudio/bestvideo+bestaudio/best`;

    const args = [
      '-f', formatSpec,
      '--recode-video', 'mp4',
      '-o', '-',
      '--',
      fullUrl
    ];

    const child = spawn(binaryPath, args);

    // ReadableStream wrapper for Web API Response
    const stream = new ReadableStream({
      start(controller) {
        child.stdout.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        child.stdout.on('end', () => {
          controller.close();
        });

        child.on('error', (err) => {
          controller.error(err);
        });

        child.stderr.on('data', (data) => {
          // Optional log debugging
        });
      },
      cancel() {
        child.kill();
      }
    });

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set('Cache-Control', 'no-cache');

    return new NextResponse(stream as any, {
      status: 200,
      headers
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Merge stream failed' }, { status: 500 });
  }
}
