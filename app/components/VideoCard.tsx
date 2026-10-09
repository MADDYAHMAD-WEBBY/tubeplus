import React from 'react';
import { VideoMetaData } from '../types/youtube';
import { Clock, Eye, User } from 'lucide-react';

interface VideoCardProps {
  meta: VideoMetaData;
}

export const VideoCard: React.FC<VideoCardProps> = ({ meta }) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (viewsStr: string) => {
    const count = parseInt(viewsStr || '0', 10);
    if (isNaN(count)) return viewsStr;
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
    return `${count} views`;
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row gap-6 items-center shadow-xl">
      <div className="relative w-full md:w-64 h-40 rounded-xl overflow-hidden flex-shrink-0 bg-dark-bg group">
        {/* eslint-disable-next-img-element */}
        <img
          src={meta.thumbnail}
          alt={meta.title}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
        />
        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-md flex items-center space-x-1">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>{formatDuration(meta.durationSeconds)}</span>
        </div>
      </div>

      <div className="flex-1 space-y-3 text-left">
        <h2 className="text-lg sm:text-xl font-bold text-white line-clamp-2 leading-snug">
          {meta.title}
        </h2>

        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-400">
          <div className="flex items-center space-x-1.5 bg-dark-bg border border-dark-border px-3 py-1.5 rounded-lg">
            <User className="w-3.5 h-3.5 text-brand-500" />
            <span className="text-slate-200">{meta.channel}</span>
          </div>

          {meta.views && (
            <div className="flex items-center space-x-1.5 bg-dark-bg border border-dark-border px-3 py-1.5 rounded-lg">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>{formatViews(meta.views)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
