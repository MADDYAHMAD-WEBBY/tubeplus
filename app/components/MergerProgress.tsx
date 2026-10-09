import React from 'react';
import { ProgressState } from '../types/youtube';
import { CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';

interface MergerProgressProps {
  progress: ProgressState;
  onDismiss?: () => void;
}

export const MergerProgress: React.FC<MergerProgressProps> = ({ progress, onDismiss }) => {
  const isCompleted = progress.stage === 'completed';
  const isError = progress.stage === 'error';

  const getUserFriendlyMessage = (msg: string) => {
    if (isCompleted) return 'Download ready! File saving to your device...';
    if (isError) return msg;
    if (msg.includes('Stage 1') || msg.includes('merging') || msg.includes('Pre-merging')) {
      return 'Preparing high quality video file for download...';
    }
    if (msg.includes('Fetching') || msg.includes('Downloading')) {
      return 'Processing media streams...';
    }
    return 'Preparing your download...';
  };

  return (
    <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-2xl space-y-4 relative group">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-dark-bg border border-dark-border text-slate-400 hover:text-white transition"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center justify-between pr-8">
        <div className="flex items-center space-x-3">
          {isCompleted ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : isError ? (
            <AlertCircle className="w-6 h-6 text-rose-500" />
          ) : (
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
              <Sparkles className="w-5 h-5 text-brand-500 animate-pulse" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-white text-base">
              {isCompleted
                ? 'Download Complete!'
                : isError
                ? 'Download Error'
                : 'Preparing Download'}
            </h3>
            <p className="text-xs text-slate-400">{getUserFriendlyMessage(progress.message)}</p>
          </div>
        </div>

        {!isError && (
          <span className="text-lg font-extrabold font-mono text-brand-500">
            {progress.percentage}%
          </span>
        )}
      </div>

      {!isError && (
        <div className="w-full h-3 bg-dark-bg border border-dark-border rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isCompleted
                ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50'
                : 'bg-gradient-to-r from-brand-600 via-rose-500 to-amber-500'
            }`}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      )}

      {isError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          {progress.message}
        </div>
      )}
    </div>
  );
};
