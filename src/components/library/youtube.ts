// YouTube's IFrame Player API (https://developers.google.com/youtube/iframe_api_reference),
// loaded once and only by Shorties, which drives the player with its own
// buttons: play and pause, the sound, the loop.

export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getPlayerState(): number;
  destroy(): void;
}

interface YouTubePlayerOptions {
  host?: string;
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YouTubePlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

interface YouTubeApi {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_STATE = { unstarted: -1, ended: 0, playing: 1, paused: 2, buffering: 3, cued: 5 } as const;

const API_URL = "https://www.youtube.com/iframe_api";
const API_TIMEOUT_MS = 10_000;

let loading: Promise<YouTubeApi> | null = null;

/** YouTube's script, once per page. Fails when it doesn't arrive (blocked,
 * offline) — Shorties then falls back to YouTube's plain player. */
export function loadYouTube(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = API_URL;
    script.async = true;
    script.onerror = () => reject(new Error("youtube_api"));
    document.head.appendChild(script);
    window.setTimeout(() => reject(new Error("youtube_api_timeout")), API_TIMEOUT_MS);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
