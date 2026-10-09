import React, { useState } from 'react';
import { VideoFormat, VideoMetaData } from '../types/youtube';
import { Download, Film, Music, Sparkles, Loader2, Check } from 'lucide-react';

interface FormatSelectorProps {
  meta: VideoMetaData;
  onPrepareMerge: (fmt: VideoFormat) => void;
  onClearProgress?: () => void;
  preparingItag?: string | number | null;
  progressPercentage?: number;
}

export const FormatSelector: React.FC<FormatSelectorProps> = ({
  meta,
  onPrepareMerge,
  onClearProgress,
  preparingItag,
  progressPercentage = 0
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');

  const allVideoFormats = meta.formats
    .filter((f) => f.hasVideo || f.type === 'videoonly' || f.type === 'progressive')
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  const audioOnlyFormats = meta.formats.filter((f) => f.type === 'audioonly' || (f.hasAudio && !f.hasVideo));

  const getReadableSize = (bytesStr: string | null) => {
    if (!bytesStr) return 'High Quality';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes) || bytes <= 0) return 'High Quality';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAudioDownload = (fmt: VideoFormat) => {
    if (onClearProgress) onClearProgress();

    const safeTitle = meta.title.replace(/[/\\?%*:|"<>]/g, '_');
    const downloadEndpoint = `/api/download?url=${encodeURIComponent(fmt.url)}&title=${encodeURIComponent(safeTitle)}&container=m4a`;

    const a = document.createElement('a');
    a.href = downloadEndpoint;
    a.download = `${safeTitle} [Audio].m4a`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
      {/* Tab Controls */}
      <div className="flex border-b border-dark-border overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('video')}
          className={`flex items-center space-x-2 px-6 py-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'video'
              ? 'border-brand-500 text-brand-500 bg-brand-500/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Video Downloads</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-500 font-bold">1080p / 4K</span>
        </button>

        <button
          onClick={() => setActiveTab('audio')}
          className={`flex items-center space-x-2 px-6 py-3 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
            activeTab === 'audio'
              ? 'border-brand-500 text-brand-500 bg-brand-500/5'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Audio (MP3 / M4A)</span>
        </button>
      </div>

      {/* Tab 1: Video Downloads */}
      {activeTab === 'video' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 flex items-center space-x-1.5">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Select your preferred resolution below. Download starts instantly with full HD sound.</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allVideoFormats.map((fmt) => {
              const isPreparing = preparingItag === fmt.itag;
              const isDone = isPreparing && progressPercentage === 100;

              return (
                <div
                  key={fmt.itag}
                  className={`flex items-center justify-between p-3.5 bg-dark-bg border rounded-xl transition ${
                    isPreparing ? 'border-brand-500/50 bg-brand-500/5' : 'border-dark-border hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-white text-sm">{fmt.qualityLabel}</span>
                      <span className="text-xs font-mono uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                        {fmt.container}
                      </span>
                      {fmt.fps && fmt.fps > 30 && (
                        <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          {fmt.fps}fps
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 block mt-1">
                      {getReadableSize(fmt.contentLength)}
                    </span>
                  </div>

                  <button
                    disabled={Boolean(preparingItag)}
                    onClick={() => onPrepareMerge(fmt)}
                    className={`px-4 py-2 rounded-lg text-white font-semibold text-xs flex items-center space-x-2 shadow-md transition ${
                      isDone
                        ? 'bg-emerald-600'
                        : isPreparing
                        ? 'bg-brand-600 cursor-wait animate-pulse'
                        : 'bg-gradient-to-r from-brand-600 to-rose-600 hover:from-brand-500 hover:to-rose-500 disabled:opacity-50'
                    }`}
                  >
                    {isDone ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Ready!</span>
                      </>
                    ) : isPreparing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{progressPercentage > 0 ? `${progressPercentage}%` : 'Preparing...'}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Download MP4</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Audio Only */}
      {activeTab === 'audio' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 flex items-center space-x-1.5">
            <Music className="w-4 h-4 text-brand-500 flex-shrink-0" />
            <span>Save high quality audio directly to your device.</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(audioOnlyFormats.length > 0 ? audioOnlyFormats : meta.formats.filter(f => f.hasAudio)).map((fmt) => (
              <div
                key={fmt.itag}
                className="flex items-center justify-between p-3.5 bg-dark-bg border border-dark-border rounded-xl hover:border-slate-700 transition"
              >
                <div>
                  <span className="font-bold text-white text-sm block">{fmt.qualityLabel}</span>
                  <span className="text-xs text-slate-400">
                    {fmt.container.toUpperCase()} • {getReadableSize(fmt.contentLength)}
                  </span>
                </div>

                <button
                  onClick={() => handleAudioDownload(fmt)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center space-x-1.5 transition border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-brand-500" />
                  <span>Save Audio</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
