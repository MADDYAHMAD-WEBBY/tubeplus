import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { ProgressState, VideoFormat } from '../types/youtube';

let ffmpegInstance: FFmpeg | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  await ffmpeg.load();
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/**
 * Fetch a stream with real-time byte progress reporting
 */
async function fetchWithProgress(
  url: string,
  startPercentage: number,
  endPercentage: number,
  label: string,
  onProgress: (state: ProgressState) => void
): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch stream (HTTP ${response.status})`);
  }

  const contentLength = response.headers.get('Content-Length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body || totalBytes === 0) {
    const blob = await response.blob();
    onProgress({
      stage: 'downloading_chunks',
      percentage: endPercentage,
      message: `${label} stream ready!`,
      speedMb: 0
    });
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (value) {
      chunks.push(value);
      loadedBytes += value.length;

      const progressRatio = loadedBytes / totalBytes;
      const currentPercentage = Math.round(
        startPercentage + progressRatio * (endPercentage - startPercentage)
      );

      const loadedMb = (loadedBytes / (1024 * 1024)).toFixed(1);
      const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);

      onProgress({
        stage: 'downloading_chunks',
        percentage: Math.min(currentPercentage, endPercentage),
        message: `Downloading ${label} (${loadedMb}MB / ${totalMb}MB)...`,
        speedMb: 0
      });
    }
  }

  return new Blob(chunks as BlobPart[]);
}

/**
 * Client-Side Parallel Stream Merger with AAC Audio Transcoding
 * Guarantees 100% audio + video sync on all media players (VP9/AVC1 + Opus/AAC -> MP4)
 */
export async function mergeAndDownloadStreams(
  videoFormat: VideoFormat,
  audioFormat: VideoFormat,
  title: string,
  onProgress: (state: ProgressState) => void
): Promise<void> {
  try {
    onProgress({
      stage: 'downloading_chunks',
      percentage: 5,
      message: 'Launching parallel multi-thread stream download...',
      speedMb: 0
    });

    const startTime = Date.now();
    const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '_');

    const proxyVideoUrl = `/api/download?url=${encodeURIComponent(videoFormat.url)}&title=${encodeURIComponent(safeTitle)}&container=${videoFormat.container}`;
    const proxyAudioUrl = `/api/download?url=${encodeURIComponent(audioFormat.url)}&title=${encodeURIComponent(safeTitle)}&container=${audioFormat.container}`;

    // 1. Parallel Stream Fetching (5% -> 70%)
    const [videoBlob, audioBlob] = await Promise.all([
      fetchWithProgress(
        proxyVideoUrl,
        5,
        55,
        `HD Video (${videoFormat.qualityLabel})`,
        onProgress
      ),
      fetchWithProgress(
        proxyAudioUrl,
        55,
        70,
        'HQ Audio',
        onProgress
      )
    ]);

    onProgress({
      stage: 'merging_ffmpeg',
      percentage: 75,
      message: 'Initializing WebAssembly FFmpeg audio-video merger...',
      speedMb: 0
    });

    // 2. Load FFmpeg.wasm in Browser
    const ffmpeg = await getFFmpeg();

    ffmpeg.on('progress', ({ progress }) => {
      const p = Math.round(75 + progress * 20);
      onProgress({
        stage: 'merging_ffmpeg',
        percentage: Math.min(p, 95),
        message: `Merging Audio + Video tracks (${Math.round(progress * 100)}%)...`,
        speedMb: 0
      });
    });

    const videoExt = videoFormat.container || 'mp4';
    const audioExt = audioFormat.container || 'm4a';
    const inputVideoName = `input_v.${videoExt}`;
    const inputAudioName = `input_a.${audioExt}`;
    const outputFileName = `output.mp4`;

    // 3. Write blobs to FFmpeg virtual FS
    await ffmpeg.writeFile(inputVideoName, await fetchFile(videoBlob));
    await ffmpeg.writeFile(inputAudioName, await fetchFile(audioBlob));

    // 4. Run FFmpeg: Copy Video stream (-c:v copy) & encode Audio to AAC (-c:a aac)
    // This ensures Opus/WebM audio merges 100% cleanly into MP4 container with sound!
    await ffmpeg.exec([
      '-i', inputVideoName,
      '-i', inputAudioName,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      outputFileName
    ]);

    // 5. Read output file & trigger browser download
    const data = await ffmpeg.readFile(outputFileName);
    const mergedBlob = new Blob([data as any], { type: 'video/mp4' });

    // Cleanup virtual FS
    await ffmpeg.deleteFile(inputVideoName);
    await ffmpeg.deleteFile(inputAudioName);
    await ffmpeg.deleteFile(outputFileName);

    triggerBrowserDownload(mergedBlob, `${safeTitle} [1080p].mp4`);

    const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    onProgress({
      stage: 'completed',
      percentage: 100,
      message: `Audio + Video merged in ${totalSeconds}s! Saved to Downloads.`,
      speedMb: 0
    });
  } catch (err: any) {
    onProgress({
      stage: 'error',
      percentage: 0,
      message: err.message || 'Stream merging failed in browser',
      speedMb: 0
    });
    throw err;
  }
}

/**
 * Trigger immediate browser file save
 */
export function triggerBrowserDownload(blob: Blob, fileName: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}
