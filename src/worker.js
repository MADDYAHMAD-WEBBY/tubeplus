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
 * InnerTube Client Context Payload Configurations
 */
const INNERTUBE_CLIENTS = [
  {
    name: "ANDROID",
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
 * Fetch Video Meta & Formats using InnerTube API
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
  let lastError = null;

  // Try rotated InnerTube client contexts
  for (const clientConfig of INNERTUBE_CLIENTS) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "X-YouTube-Client-Name": clientConfig.name === "ANDROID" ? "3" : clientConfig.name === "IOS" ? "5" : "85",
          "X-YouTube-Client-Version": clientConfig.name === "ANDROID" ? "19.02.39" : "19.45.4"
        },
        body: JSON.stringify(clientConfig.payload(videoId))
      });

      if (!res.ok) continue;
      const data = await res.json();

      if (data && data.videoDetails && data.streamingData) {
        playerResponse = data;
        break;
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!playerResponse) {
    return new Response(JSON.stringify({
      error: "Failed to extract streaming data from YouTube. Video may be private, age-restricted, or blocked.",
      details: lastError ? lastError.message : "InnerTube response contained no streamingData"
    }), {
      status: 422,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  const { videoDetails, streamingData } = playerResponse;

  // Process formats into clean categories for frontend UI
  const formats = [];
  const rawFormats = [
    ...(streamingData.formats || []),
    ...(streamingData.adaptiveFormats || [])
  ];

  for (const f of rawFormats) {
    let streamUrl = f.url;
    
    // Parse decipher signature if present
    if (!streamUrl && f.signatureCipher) {
      const params = new URLSearchParams(f.signatureCipher);
      streamUrl = params.get("url");
      // Note: If cipher decryption is required for certain web formats, 
      // fallback to proxy-stream or direct progressive stream
    }

    if (!streamUrl) continue;

    const isAudioOnly = f.mimeType && f.mimeType.startsWith("audio/");
    const isVideoOnly = f.mimeType && f.mimeType.startsWith("video/") && !f.audioQuality;
    const isCombo = f.mimeType && f.mimeType.startsWith("video/") && Boolean(f.audioQuality);

    formats.push({
      itag: f.itag,
      url: streamUrl,
      qualityLabel: f.qualityLabel || (isAudioOnly ? `${Math.round((f.bitrate || 128000) / 1000)}kbps Audio` : "SD"),
      mimeType: f.mimeType,
      container: getContainer(f.mimeType),
      contentLength: f.contentLength || null,
      bitrate: f.bitrate || 0,
      width: f.width || null,
      height: f.height || null,
      fps: f.fps || null,
      type: isCombo ? "progressive" : isVideoOnly ? "videoonly" : "audioonly",
      hasAudio: isCombo || isAudioOnly,
      hasVideo: isCombo || isVideoOnly
    });
  }

  const result = {
    id: videoDetails.videoId,
    title: videoDetails.title,
    channel: videoDetails.author,
    durationSeconds: parseInt(videoDetails.lengthSeconds || "0", 10),
    views: videoDetails.viewCount,
    thumbnail: videoDetails.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
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
 * Optional Proxy Stream route to handle byte-range CDN requests directly
 */
async function handleProxyStream(request, url) {
  const targetUrl = url.searchParams.get("streamUrl");
  if (!targetUrl) {
    return new Response("Missing streamUrl parameter", { status: 400, headers: CORS_HEADERS });
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

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}
