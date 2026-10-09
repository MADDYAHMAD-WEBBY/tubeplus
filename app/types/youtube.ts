export interface VideoFormat {
  itag: number;
  url: string;
  qualityLabel: string;
  mimeType: string;
  container: string;
  contentLength: string | null;
  bitrate: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  type: 'progressive' | 'videoonly' | 'audioonly';
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface VideoMetaData {
  id: string;
  title: string;
  channel: string;
  durationSeconds: number;
  views: string;
  thumbnail: string;
  formats: VideoFormat[];
}

export type ProcessStage = 'idle' | 'fetching_info' | 'downloading_chunks' | 'merging_ffmpeg' | 'completed' | 'error';

export interface ProgressState {
  stage: ProcessStage;
  percentage: number;
  message: string;
  speedMb: number;
}
