export function extractVideoId(inputUrl: string): string | null {
  if (!inputUrl) return null;
  const cleanUrl = inputUrl.trim();

  const vMatch = cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (vMatch && vMatch[1]) return vMatch[1];

  const youtuMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (youtuMatch && youtuMatch[1]) return youtuMatch[1];

  const shortsMatch = cleanUrl.match(/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];

  const embedMatch = cleanUrl.match(/(?:embed|live)\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch && embedMatch[1]) return embedMatch[1];

  const directMatch = cleanUrl.match(/^([a-zA-Z0-9_-]{11})$/);
  if (directMatch && directMatch[1]) return directMatch[1];

  return null;
}
