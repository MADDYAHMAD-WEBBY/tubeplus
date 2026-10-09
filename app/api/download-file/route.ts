import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Periodic cleanup of temp files older than 15 minutes
function cleanupOldTempFiles() {
  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    const now = Date.now();

    for (const f of files) {
      if (f.startsWith('merged_') && f.endsWith('.mp4')) {
        const fullPath = path.join(tmpDir, f);
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > 15 * 60 * 1000) {
          fs.unlinkSync(fullPath);
        }
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

export async function GET(request: NextRequest) {
  cleanupOldTempFiles();

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('file');
  const name = searchParams.get('name') || 'video.mp4';

  if (!fileId || !/^[a-zA-Z0-9._-]+$/.test(fileId)) {
    return NextResponse.json({ error: 'Invalid file parameter' }, { status: 400 });
  }

  const filePath = path.join(os.tmpdir(), fileId);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found or link expired' }, { status: 404 });
  }

  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const rangeHeader = request.headers.get('range');

    const safeFilename = encodeURIComponent(name);

    // Support IDM / Browser Range Requests (206 Partial Content)
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });

      const headers = new Headers();
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Content-Length', chunkSize.toString());
      headers.set('Content-Type', 'video/mp4');
      headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);

      return new NextResponse(fileStream as any, {
        status: 206,
        headers
      });
    }

    // Full Content Download (200 OK)
    const fileStream = fs.createReadStream(filePath);

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', fileSize.toString());
    headers.set('Content-Type', 'video/mp4');
    headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);

    return new NextResponse(fileStream as any, {
      status: 200,
      headers
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'File download failed' }, { status: 500 });
  }
}
