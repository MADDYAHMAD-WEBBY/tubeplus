import React, { useState } from 'react';
import { Search, Clipboard, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface DownloaderFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export const DownloaderForm: React.FC<DownloaderFormProps> = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch (err) {
      // Permission denied fallback
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand-600 via-rose-500 to-amber-500 opacity-30 group-hover:opacity-60 blur-lg transition duration-500"></div>

        <div className="relative flex flex-col sm:flex-row items-center gap-2 p-2 bg-dark-card border border-dark-border rounded-2xl shadow-2xl">
          <div className="flex items-center flex-1 w-full pl-3 pr-2 py-2">
            <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube Video or Shorts link here..."
              className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm sm:text-base font-normal"
              disabled={isLoading}
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="text-xs text-slate-400 hover:text-white px-2 py-1"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handlePaste}
              className="flex items-center space-x-1.5 text-xs font-medium text-slate-300 hover:text-white bg-dark-bg border border-dark-border px-3 py-2 rounded-xl transition hover:bg-slate-800 ml-2"
              title="Paste link from clipboard"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Paste</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-rose-600 hover:from-brand-500 hover:to-rose-500 text-white font-semibold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-brand-600/20 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading Video...</span>
              </>
            ) : (
              <>
                <span>Download</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-center space-x-2 mt-4 text-xs text-slate-400">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>Supports 4K, 1080p Full HD, Shorts, & MP3 Music downloads</span>
      </div>
    </div>
  );
};
