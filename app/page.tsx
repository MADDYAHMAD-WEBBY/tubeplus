'use client';

import React, { useState } from 'react';
import { Header } from './components/Header';
import { DownloaderForm } from './components/DownloaderForm';
import { VideoCard } from './components/VideoCard';
import { FormatSelector } from './components/FormatSelector';
import { MergerProgress } from './components/MergerProgress';
import { VideoMetaData, VideoFormat, ProgressState } from './types/youtube';
import { ShieldCheck, Zap, Sparkles, Film } from 'lucide-react';

export default function Home() {
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMetaData | null>(null);
  const [preparingItag, setPreparingItag] = useState<string | number | null>(null);
  const [progressPercentage, setProgressPercentage] = useState<number>(0);

  const getApiBaseUrl = () => {
    if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
      return 'https://yt-downloader-api.tubeplus.workers.dev';
    }
    return '';
  };

  const handleFetchInfo = async (inputUrl: string) => {
    setLoadingInfo(true);
    setErrorMsg(null);
    setVideoMeta(null);
    setPreparingItag(null);
    setProgressPercentage(0);

    try {
      const apiBase = getApiBaseUrl();
      let data: VideoMetaData | null = null;

      if (apiBase) {
        try {
          const res = await fetch(`${apiBase}/api/info?url=${encodeURIComponent(inputUrl)}`);
          if (res.ok) {
            const resData = await res.json();
            if (resData && resData.formats && resData.formats.length > 0) {
              data = resData;
            }
          }
        } catch (workerErr) {}
      }

      // Local API server fallback (uses yt-dlp binary with 100% video format extraction)
      if (!data) {
        const localRes = await fetch(`/api/info?url=${encodeURIComponent(inputUrl)}`);
        const localData = await localRes.json();
        if (!localRes.ok || localData.error) {
          throw new Error(localData.error || 'Failed to fetch YouTube video metadata');
        }
        data = localData;
      }

      setVideoMeta(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error connecting to video server');
    } finally {
      setLoadingInfo(false);
    }
  };

  /**
   * Fast Inline Download Preparation
   */
  const handlePrepareMerge = async (fmt: VideoFormat) => {
    if (!videoMeta) return;

    const qualityHeight = fmt.height || (fmt.qualityLabel.includes('1080') ? 1080 : fmt.qualityLabel.includes('720') ? 720 : 480);
    const safeTitle = videoMeta.title.replace(/[/\\?%*:|"<>]/g, '_');
    const apiBase = getApiBaseUrl();

    setPreparingItag(fmt.itag);
    setProgressPercentage(25);

    try {
      if (apiBase) {
        // Live Cloudflare Worker Production Stream
        setProgressPercentage(100);

        const downloadUrl = `${apiBase}/api/proxy-stream?streamUrl=${encodeURIComponent(fmt.url)}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${safeTitle} [${qualityHeight}p].mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
          setPreparingItag(null);
          setProgressPercentage(0);
        }, 1500);
        return;
      }

      // Local Node.js Backend Server FFmpeg Muxing
      const res = await fetch(`/api/prepare-merge?v=${videoMeta.id}&title=${encodeURIComponent(safeTitle)}&quality=${qualityHeight}&itag=${fmt.itag}`);
      const data = await res.json();

      if (!res.ok || !data.readyUrl) {
        throw new Error(data.error || 'Failed to prepare video file');
      }

      setProgressPercentage(100);

      // Trigger Browser Download
      const a = document.createElement('a');
      a.href = data.readyUrl;
      a.download = data.filename || `${safeTitle} [${qualityHeight}p].mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        setPreparingItag(null);
        setProgressPercentage(0);
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Video download preparation failed');
      setPreparingItag(null);
      setProgressPercentage(0);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-radial from-dark-bg via-[#0b0e17] to-black">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full space-y-10">
        {/* Hero Section */}
        <section className="text-center space-y-4 pt-4">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-500 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ultra HD 4K & MP3 Downloader</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Download YouTube Videos <br />
            <span className="bg-gradient-to-r from-brand-500 via-rose-400 to-amber-400 bg-clip-text text-transparent">
              In Full HD 1080p & 4K Free
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400">
            Fast, free, and high-quality MP4 & MP3 downloads for all your favorite YouTube videos and Shorts with full audio sync.
          </p>
        </section>

        {/* Downloader Form Card */}
        <DownloaderForm onSubmit={handleFetchInfo} isLoading={loadingInfo} />

        {/* Error Alert */}
        {errorMsg && (
          <div className="max-w-3xl mx-auto p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm font-medium text-center shadow-lg">
            {errorMsg}
          </div>
        )}

        {/* Video Card & Format Selection */}
        {videoMeta && (
          <div className="max-w-3xl mx-auto space-y-6">
            <VideoCard meta={videoMeta} />
            <FormatSelector 
              meta={videoMeta} 
              onPrepareMerge={handlePrepareMerge}
              preparingItag={preparingItag}
              progressPercentage={progressPercentage}
            />
          </div>
        )}

        {/* Features Grid */}
        <section className="pt-12 border-t border-dark-border grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-dark-card border border-dark-border rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Film className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Ultra HD 4K & 1080p</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Download videos in crisp 1080p Full HD, 60fps, and 4K resolutions with crystal-clear stereo sound.
            </p>
          </div>

          <div className="p-6 bg-dark-card border border-dark-border rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Instant High Speed</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fast file preparation ensures your downloads start immediately without long waiting times.
            </p>
          </div>

          <div className="p-6 bg-dark-card border border-dark-border rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">100% Free & Secure</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No registration required, no hidden costs. Unlimited downloads for videos, music, and Shorts.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-dark-border py-6 text-center text-xs text-slate-500 bg-black/50">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 TubePulse PRO. All rights reserved.</p>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Privacy</span>
            <span>•</span>
            <span>Terms</span>
            <span>•</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
