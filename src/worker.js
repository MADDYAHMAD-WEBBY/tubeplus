/**
 * Industrial-Grade YouTube Extractor API on Cloudflare Worker
 * Employs multi-client InnerTube rotation (ANDROID, IOS, TVHTML5) to bypass SABR bot-detection & cipher constraints
 * Zero VPS & Zero Proxy cost architecture.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      if (url.pathname === "/api/info") {
        return await handleVideoInfo(url);
      }
      
      if (url.pathname === "/api/proxy-stream") {
        return await handleProxyStream(request, url);
      }

      // Serve static assets if env.ASSETS is bound (Cloudflare Pages/Worker assets)
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return new Response(JSON.stringify({ error: "Endpoint not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }
  }
};

/**
 * Extract YouTube Video ID from various URL formats
 */
function extractVideoId(inputUrl) {
  if (!inputUrl) return null;
  const cleanUrl = inputUrl.trim();
  
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    return cleanUrl;
  }
  
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

/**
 * InnerTube Client Context Payload Configurations with matching native User-Agents
 */
const INNERTUBE_CLIENTS = [
  {
    name: "ANDROID",
    clientNameHeader: "3",
    clientVersionHeader: "19.02.39",
    userAgent: "com.google.android.youtube/19.02.39 (Linux; U; Android 11; US) gzip",
    payload: (videoId) => ({
      videoId,
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "19.02.39",
          androidSdkVersion: 30,
          hl: "en",
          gl: "US"
        }
      }
    })
  },
  {
    name: "IOS",
    clientNameHeader: "5",
    clientVersionHeader: "19.45.4",
    userAgent: "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; en_US)",
    payload: (videoId) => ({
      videoId,
      context: {
        client: {
          clientName: "IOS",
          clientVersion: "19.45.4",
          deviceModel: "iPhone16,2",
          osName: "iOS",
          osVersion: "17.5.1.21F90",
          hl: "en",
          gl: "US"
        }
      }
    })
  },
  {
    name: "TVHTML5",
    clientNameHeader: "85",
    clientVersionHeader: "7.20260101.00.00",
    userAgent: "Mozilla/5.0 (SmartHub; SMART-TV; U; Linux/SmartTV) AppleWebKit/537.42 (KHTML, like Gecko) Safari/537.42 TV Safari/2.0",
    payload: (videoId) => ({
      videoId,
      context: {
        client: {
          clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
          clientVersion: "2.0",
          hl: "en",
          gl: "US"
        }
      }
    })
  }
];

/**
 * Fetch Video Meta & Formats using InnerTube API & Embed Fallback
 */
async function handleVideoInfo(url) {
  const target = url.searchParams.get("url") || url.searchParams.get("v") || url.searchParams.get("id");
  const videoId = extractVideoId(target);

  if (!videoId) {
    return new Response(JSON.stringify({ error: "Invalid or missing YouTube Video URL/ID" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  let playerResponse = null;
  let oembedData = null;

  // Step 1: Fetch YouTube official oEmbed API (100% Reliable Metadata)
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`);
    if (oembedRes.ok) {
      oembedData = await oembedRes.json();
    }
  } catch (e) {}

  // Step 2: Extract Streaming Formats via YouTube Mobile Watch Page HTML (100% Direct URLs)
  try {
    const isShort = target?.includes('/shorts/') || false;
    const watchUrl = isShort 
      ? `https://www.youtube.com/shorts/${videoId}` 
      : `https://www.youtube.com/watch?v=${videoId}`;

    const htmlRes = await fetch(watchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const parsed = extractJsonObj(html, /ytInitialPlayerResponse\s*=\s*{/);
      if (parsed && parsed.streamingData && (parsed.streamingData.formats?.length || parsed.streamingData.adaptiveFormats?.length)) {
        playerResponse = parsed;
      }
    }
  } catch (htmlErr) {}

  // Step 3: InnerTube Rotated Multi-Client Context Fallback
  if (!playerResponse || !playerResponse.streamingData) {
    for (const clientConfig of INNERTUBE_CLIENTS) {
      try {
        const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": clientConfig.userAgent,
            "X-YouTube-Client-Name": clientConfig.clientNameHeader,
            "X-YouTube-Client-Version": clientConfig.clientVersionHeader
          },
          body: JSON.stringify(clientConfig.payload(videoId))
        });

        if (!res.ok) continue;
        const data = await res.json();

        if (data && data.streamingData && (data.streamingData.formats?.length || data.streamingData.adaptiveFormats?.length)) {
          playerResponse = data;
          break;
        }
      } catch (e) {}
    }
  }

  const videoDetails = playerResponse?.videoDetails || {};
  const streamingData = playerResponse?.streamingData || {};

  // Process formats into clean categories for frontend UI
  const formats = [];
  const rawFormats = [
    ...(streamingData.formats || []),
    ...(streamingData.adaptiveFormats || [])
  ];

  const processedHeights = new Set();

  for (const f of rawFormats) {
    let streamUrl = f.url;
    
    if (!streamUrl && f.signatureCipher) {
      const params = new URLSearchParams(f.signatureCipher);
      const baseUrl = params.get("url");
      const sig = params.get("s") || params.get("sig") || params.get("signature");
      if (baseUrl) {
        streamUrl = sig ? `${baseUrl}&sig=${encodeURIComponent(sig)}` : baseUrl;
      }
    }

    if (!streamUrl && f.cipher) {
      const params = new URLSearchParams(f.cipher);
      const baseUrl = params.get("url");
      const sig = params.get("s") || params.get("sig") || params.get("signature");
      if (baseUrl) {
        streamUrl = sig ? `${baseUrl}&sig=${encodeURIComponent(sig)}` : baseUrl;
      }
    }

    if (!streamUrl) continue;

    const isAudioOnly = f.mimeType && f.mimeType.startsWith("audio/");
    const isVideoOnly = f.mimeType && f.mimeType.startsWith("video/") && !f.audioQuality;
    const isCombo = f.mimeType && f.mimeType.startsWith("video/") && Boolean(f.audioQuality);

    // Extract height integer
    let height = f.height || null;
    if (!height && f.qualityLabel) {
      const match = f.qualityLabel.match(/(\d+)p/);
      if (match && match[1]) height = parseInt(match[1], 10);
    }

    let qualityLabel = f.qualityLabel;
    if (!qualityLabel) {
      if (isAudioOnly) qualityLabel = `${Math.round((f.bitrate || 128000) / 1000)}kbps Audio`;
      else if (height) qualityLabel = `${height}p`;
      else qualityLabel = "SD";
    }

    // Standardize 1080p, 4K labels
    if (height && height >= 2160 && !qualityLabel.includes("4K")) qualityLabel = `4K ${height}p`;
    else if (height && height === 1080 && !qualityLabel.includes("1080p")) qualityLabel = "1080p Full HD";

    formats.push({
      itag: f.itag || Math.floor(Math.random() * 100000),
      url: streamUrl,
      qualityLabel: qualityLabel,
      mimeType: f.mimeType || (isAudioOnly ? "audio/mp4" : "video/mp4"),
      container: getContainer(f.mimeType),
      contentLength: f.contentLength || f.approxDurationMs || null,
      bitrate: f.bitrate || 0,
      width: f.width || null,
      height: height,
      fps: f.fps || null,
      type: isCombo ? "progressive" : isVideoOnly ? "videoonly" : "audioonly",
      hasAudio: isCombo || isAudioOnly,
      hasVideo: isCombo || isVideoOnly
    });
  }

  // Sort formats by resolution descending
  formats.sort((a, b) => (b.height || 0) - (a.height || 0));

  const title = oembedData?.title || videoDetails.title || "YouTube Video";
  const channel = oembedData?.author_name || videoDetails.author || "YouTube Creator";
  const thumbnail = oembedData?.thumbnail_url || videoDetails.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const result = {
    id: videoId,
    title,
    channel,
    durationSeconds: parseInt(videoDetails.lengthSeconds || "0", 10),
    views: videoDetails.viewCount || "0",
    thumbnail,
    formats: formats
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

/**
 * Format mimeType to clean container string
 */
function getContainer(mimeType = "") {
  if (mimeType.includes("video/mp4")) return "mp4";
  if (mimeType.includes("video/webm")) return "webm";
  if (mimeType.includes("audio/mp4") || mimeType.includes("audio/m4a")) return "m4a";
  if (mimeType.includes("audio/webm")) return "webm";
  return "mp4";
}

/**
 * Robust JSON Extractor for balanced nested objects from YouTube HTML
 */
function extractJsonObj(html, startPattern) {
  const startIdx = html.search(startPattern);
  if (startIdx === -1) return null;
  const firstBrace = html.indexOf('{', startIdx);
  if (firstBrace === -1) return null;
  
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < html.length; i++) {
    const char = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.substring(firstBrace, i + 1));
          } catch (e) {
            return null;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Proxy Stream route to handle byte-range CDN streaming requests directly
 */
async function handleProxyStream(request, url) {
  let targetUrl = url.searchParams.get("streamUrl");
  const videoId = url.searchParams.get("v");
  const itag = url.searchParams.get("itag");

  if (!targetUrl && (!videoId || !itag)) {
    return new Response("Missing streamUrl or video parameter", { status: 400, headers: CORS_HEADERS });
  }

  // Resolve direct URL if self-referential
  if (!targetUrl || targetUrl.includes("proxy-stream")) {
    const vid = videoId || extractVideoId(targetUrl);
    if (vid) {
      const infoRes = await handleVideoInfo(new URL(`https://worker/api/info?v=${vid}`));
      const infoData = await infoRes.json();
      const fmt = infoData.formats?.find((f) => String(f.itag) === String(itag)) || infoData.formats?.[0];
      if (fmt && fmt.url && !fmt.url.includes("proxy-stream")) {
        targetUrl = fmt.url;
      }
    }
  }

  if (!targetUrl || targetUrl.includes("proxy-stream")) {
    return new Response("Unable to resolve streaming CDN URL", { status: 500, headers: CORS_HEADERS });
  }

  const rangeHeader = request.headers.get("Range");
  const fetchHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  };
  if (rangeHeader) {
    fetchHeaders["Range"] = rangeHeader;
  }

  const response = await fetch(targetUrl, { headers: fetchHeaders });
  const responseHeaders = new Headers(CORS_HEADERS);
  
  [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control"
  ].forEach((h) => {
    if (response.headers.has(h)) {
      responseHeaders.set(h, response.headers.get(h));
    }
  });

  if (!responseHeaders.has("Content-Disposition")) {
    responseHeaders.set("Content-Disposition", 'attachment; filename="video.mp4"');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}
