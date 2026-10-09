import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const streamUrl = searchParams.get('url') || searchParams.get('streamUrl');
  const title = searchParams.get('title') || 'video';
  const container = searchParams.get('container') || 'mp4';

  if (!streamUrl) {
    return NextResponse.json({ error: 'Missing streamUrl parameter' }, { status: 400 });
  }

  try {
    const rangeHeader = request.headers.get('Range');
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Encoding': 'identity'
    };

    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const response = await fetch(streamUrl, {
      headers: fetchHeaders,
      cache: 'no-store'
    });

    if (!response.ok) {
      return NextResponse.json({ error: `CDN returned status ${response.status}` }, { status: response.status });
    }

    const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `${safeTitle}.${container}`;

    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, immutable');
    headers.set('Content-Type', response.headers.get('content-type') || 'video/mp4');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    headers.set('Accept-Ranges', 'bytes');
    
    if (response.headers.has('content-length')) {
      headers.set('Content-Length', response.headers.get('content-length')!);
    }
    if (response.headers.has('content-range')) {
      headers.set('Content-Range', response.headers.get('content-range')!);
    }

    return new NextResponse(response.body as any, {
      status: response.status,
      headers
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Stream download proxy failed' }, { status: 500 });
  }
}
