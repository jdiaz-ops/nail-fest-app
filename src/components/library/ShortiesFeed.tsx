"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { showCuponeraNotice } from "@/components/cuponera/PreviewLink";
import {
  formatDuration,
  shortiesSlides,
  shuffled,
  themeOf,
  toneOf,
  topicKey,
  youtubeLoopEmbedUrl,
  youtubeThumbnail,
  type LibraryMenuData,
  type ShortItem,
} from "@/lib/library/shared";
import LibraryMenu from "./LibraryMenu";
import UsedProducts from "./UsedProducts";
import { pingView } from "./ViewPing";
import { Avatar, LockIcon, SampleBadge } from "./parts";
import { YT_STATE, loadYouTube, type YouTubePlayer } from "./youtube";

export interface ShortiesTexts {
  title: string;
  subtitle: string;
  hint: string;
  sound: string;
  profile: string;
  used: string;
  steps: string;
  share: string;
  stepsLink: string;
  endTitle: string;
  endText: string;
  endAgain: string;
  endLibrary: string;
  empty: string;
  signupTitle: string;
  signupText: string;
  signupButton: string;
  signupLater: string;
  seal: string;
  locked: string;
  lockedButton: string;
  usedTitle: string;
  usedSubtitle: string;
  buy: string;
}

/** api: the feed drives YouTube's player. native: this browser wouldn't let
 * the feed turn the sound on, so YouTube's own controls do. plain: YouTube's
 * script never arrived — its plain player, with its controls. */
type Mode = "api" | "native" | "plain";

// Before a short's player loads: long enough that flicking past it doesn't.
const SETTLE_MS = 250;
// The feed's address ("/biblioteca/shorties" until 2026-10-24).
const CORTOS = "/biblioteca/cortos";
// A description longer than this gets «Ver más».
const DESCRIPTION_CLAMP = 90;

function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const PATHS = {
  back: <path d="M15 18l-6-6 6-6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  muted: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M17 9.5l4 5M21 9.5l-4 5" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  steps: (
    <>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="M4 5.5l1.5 1.5L8 4.5M4 11.5l1.5 1.5L8 10.5M4 17.5l1.5 1.5L8 16.5" />
    </>
  ),
  share: (
    <>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 3v12M7 8l5-5 5 5" />
    </>
  ),
  check: <path d="M5 12.5l4 4L19 7" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  shorties: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10.5 9.2v5.6l4.4-2.8z" fill="currentColor" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
};

/** The playing short's YouTube player: silent at first (what every browser
 * allows on its own), looping, and — in "api" mode — without YouTube's
 * controls, since the feed's own buttons drive it. */
function ShortPlayer({
  youtubeId,
  title,
  native,
  onPlayer,
  onApiFail,
  onVideoError,
}: {
  youtubeId: string;
  title: string;
  native: boolean;
  onPlayer: (player: YouTubePlayer | null) => void;
  onApiFail: () => void;
  onVideoError: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onPlayer, onApiFail, onVideoError });
  callbacks.current = { onPlayer, onApiFail, onVideoError };

  useEffect(() => {
    const box = host.current;
    if (!box) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    const mount = document.createElement("div");
    box.appendChild(mount);
    loadYouTube().then(
      (YT) => {
        if (cancelled) return;
        player = new YT.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          videoId: youtubeId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: native ? 1 : 0,
            loop: 1,
            playlist: youtubeId,
            playsinline: 1,
            rel: 0,
            iv_load_policy: 3,
            fs: 0,
            disablekb: 1,
            modestbranding: 1,
          },
          events: {
            onReady: (event) => {
              if (!cancelled) callbacks.current.onPlayer(event.target);
            },
            // Removed, private, or its owner doesn't allow it outside YouTube.
            onError: () => {
              if (!cancelled) callbacks.current.onVideoError();
            },
          },
        });
      },
      () => {
        if (!cancelled) callbacks.current.onApiFail();
      },
    );
    return () => {
      cancelled = true;
      callbacks.current.onPlayer(null);
      try {
        player?.destroy();
      } catch {
        // Already gone with the page.
      }
      box.textContent = "";
    };
  }, [youtubeId, native]);

  return <div ref={host} className="bib-short-player" title={title} />;
}

interface Props {
  items: ShortItem[];
  /** Only one topic's cortos (?tema=): its chip at the top clears it. */
  topic: { key: string; label: string } | null;
  texts: ShortiesTexts;
  menu: LibraryMenuData;
  titleClass: string;
  /** A sign-up card after every this many; null = none (signed up). */
  signupEvery: number | null;
  /** Signed up (or staff): the shorties behind the sign-up play. */
  unlocked: boolean;
  /** The instructors' profiles are open to this viewer. */
  profiles: boolean;
  showUsed: boolean;
  showSteps: boolean;
  staffNote: string | null;
}

// nailfest.lat/biblioteca/cortos (the approved mockup of 2026-10-24, then
// "Shorties"): one short at a time, full screen, swipe up for the next — in
// a new order every visit. Only the short on screen loads a player; the
// others are YouTube's stills. The sound needs a tap (browsers start videos
// silent); where even that isn't allowed, YouTube's own button takes over.
// Each short says what it is (title and description), and its theme and
// tags open the cortos of that topic.
export default function ShortiesFeed({ items: firstOrder, topic, texts, menu, titleClass, signupEvery, unlocked, profiles, showUsed, showSteps, staffNote }: Props) {
  const [items, setItems] = useState(firstOrder);
  // Each "again" builds the feed anew: scrolling it back to the top instead
  // would land on the short that was there, now somewhere else.
  const [round, setRound] = useState(0);
  const slides = useMemo(() => shortiesSlides(items, signupEvery), [items, signupEvery]);
  const feed = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [settled, setSettled] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mode, setMode] = useState<Mode>("api");
  const modeRef = useRef<Mode>("api");
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  // What's covering the video right now (the menu, "Lo que usó", another tab).
  const held = useRef(new Set<string>());
  const player = useRef<YouTubePlayer | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [sheetItem, setSheetItem] = useState<ShortItem | null>(null);
  const sheetClose = useRef<HTMLButtonElement>(null);
  const sheetOpener = useRef<HTMLElement | null>(null);
  const counted = useRef(new Set<string>());
  // The short whose whole description is open.
  const [openDescription, setOpenDescription] = useState<string | null>(null);

  /** The player follows the pause: the person's, or something on top. */
  const apply = useCallback(() => {
    const p = player.current;
    if (!p) return;
    try {
      if (pausedRef.current || held.current.size > 0) p.pauseVideo();
      else p.playVideo();
    } catch {
      // The player went away mid-call (scrolled past).
    }
  }, []);
  const hold = useCallback(
    (reason: string) => {
      held.current.add(reason);
      apply();
    },
    [apply],
  );
  const release = useCallback(
    (reason: string) => {
      held.current.delete(reason);
      apply();
    },
    [apply],
  );

  /** Did the browser let it sound? If it stopped the video instead, back to
   * silent — and when not even a tap was enough, YouTube's controls take over. */
  const verifySound = useCallback((p: YouTubePlayer, fromTap: boolean) => {
    let tries = 0;
    const check = () => {
      if (player.current !== p || !soundRef.current) return;
      let state: number = YT_STATE.unstarted;
      try {
        state = p.getPlayerState();
      } catch {
        return;
      }
      if (state === YT_STATE.buffering && tries++ < 4) {
        window.setTimeout(check, 700);
        return;
      }
      if (state === YT_STATE.playing || pausedRef.current || held.current.size > 0) return;
      try {
        p.mute();
        p.playVideo();
      } catch {
        // Gone already.
      }
      soundRef.current = false;
      setSound(false);
      if (fromTap) {
        modeRef.current = "native";
        setMode("native");
        showCuponeraNotice("En este celular, el sonido se activa con el botón del video.");
      }
    };
    window.setTimeout(check, 900);
  }, []);

  const onPlayer = useCallback(
    (p: YouTubePlayer | null) => {
      player.current = p;
      if (!p) return;
      if (modeRef.current === "api") {
        try {
          if (soundRef.current) {
            p.unMute();
            verifySound(p, false);
          } else {
            p.mute();
          }
        } catch {
          // Gone already.
        }
      }
      apply();
    },
    [apply, verifySound],
  );

  const onApiFail = useCallback(() => {
    modeRef.current = "plain";
    setMode("plain");
  }, []);

  const enableSound = () => {
    soundRef.current = true;
    setSound(true);
    pausedRef.current = false;
    setPaused(false);
    const p = player.current;
    if (!p) return;
    // Right here, inside the tap: some browsers only allow sound then.
    try {
      p.unMute();
      p.playVideo();
    } catch {
      // Gone already.
    }
    verifySound(p, true);
  };
  const muteSound = () => {
    soundRef.current = false;
    setSound(false);
    try {
      player.current?.mute();
    } catch {
      // Gone already.
    }
  };
  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    apply();
  };

  const goTo = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const el = feed.current;
      if (!el) return;
      const target = Math.max(0, Math.min(index, slides.length - 1));
      el.scrollTo({ top: target * el.clientHeight, behavior });
    },
    [slides.length],
  );

  // Which short is on screen: the one the scroll snapped to.
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const index = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
        if (index !== activeRef.current) {
          activeRef.current = index;
          setActive(index);
        }
        if (el.scrollTop > 8) setScrolled(true);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [round]);

  // A new short on screen: it plays (unless something covers it), its
  // address goes in the bar — to share it, or to come back to it — and,
  // once it settles, it counts as a view.
  useEffect(() => {
    setSettled(false);
    pausedRef.current = false;
    setPaused(false);
    const slide = slides[active];
    if (slide?.kind === "video") window.history.replaceState(null, "", `${CORTOS}?v=${slide.item.video.slug}${topic ? `&tema=${topic.key}` : ""}`);
    const timer = window.setTimeout(() => {
      setSettled(true);
      if (slide?.kind !== "video") return;
      const { video } = slide.item;
      if (video.sample || (video.gated && !unlocked) || counted.current.has(video.id)) return;
      counted.current.add(video.id);
      pingView(video.id);
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [active, slides, unlocked, topic]);

  // The keyboard on a computer: arrows to move, space to pause, M for the sound.
  const keys = useRef({ goTo, togglePause, enableSound, muteSound });
  keys.current = { goTo, togglePause, enableSound, muteSound };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.querySelector("dialog[open], .bib-sheet")) return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        keys.current.goTo(activeRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        keys.current.goTo(activeRef.current - 1);
      } else if (e.key === " " && tag !== "BUTTON" && tag !== "A") {
        e.preventDefault();
        keys.current.togglePause();
      } else if (e.key === "m" || e.key === "M") {
        if (soundRef.current) keys.current.muteSound();
        else keys.current.enableSound();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Another tab or the phone locked: the video waits.
  useEffect(() => {
    const onVisibility = () => (document.hidden ? hold("hidden") : release("hidden"));
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [hold, release]);

  const onMenu = useCallback((open: boolean) => (open ? hold("menu") : release("menu")), [hold, release]);

  const openSheet = (item: ShortItem, opener: HTMLElement) => {
    sheetOpener.current = opener;
    setSheetItem(item);
    hold("sheet");
  };
  const closeSheet = useCallback(() => {
    setSheetItem(null);
    release("sheet");
    sheetOpener.current?.focus();
  }, [release]);
  useEffect(() => {
    if (!sheetItem) return;
    sheetClose.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetItem, closeSheet]);

  const share = async (item: ShortItem) => {
    const url = `${window.location.origin}${CORTOS}?v=${item.video.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.video.title, url });
      } catch {
        // Closed without sharing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showCuponeraNotice("Copiamos el enlace del video.");
    } catch {
      showCuponeraNotice(url);
    }
  };

  const again = () => {
    setItems((list) => shuffled(list));
    setRound((r) => r + 1);
    activeRef.current = 0;
    setActive(0);
  };

  const here = (slug?: string) => {
    const params = [slug && `v=${slug}`, topic && `tema=${topic.key}`].filter(Boolean).join("&");
    return params ? `${CORTOS}?${params}` : CORTOS;
  };
  const signupHref = (slug?: string) => `/biblioteca/registro?volver=${encodeURIComponent(here(slug))}`;
  const topicChip = topic && (
    <Link href={CORTOS} className="bib-shorts-topic" aria-label={`Quitar el tema ${topic.label}: ver todos los cortos`}>
      {topic.label}
      <Icon size={14}>{PATHS.close}</Icon>
    </Link>
  );
  const sheetDiscounted = sheetItem?.products.some((p) => p.discountPercent != null && p.code) ?? false;

  return (
    <>
      <header className="bib-header bib-shorts-head">
        <div className="bib-header-inner">
          <LibraryMenu menu={menu} titleClass={titleClass} onOpenChange={onMenu} />
          <Link href="/biblioteca" className="bib-brand" aria-label="Biblioteca Nail Fest, inicio">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt="Nail Fest" />
            <span>Biblioteca</span>
          </Link>
        </div>
      </header>

      <div className="bib-shorts-top">
        <LibraryMenu menu={menu} titleClass={titleClass} dark onOpenChange={onMenu} />
        <span className="bib-shorts-heading">
          <h1 className={`bib-shorts-title ${titleClass}`}>{texts.title}</h1>
          {topicChip}
          {staffNote && (
            <Link href="/admin/biblioteca" className="bib-shorts-staff" title={staffNote}>
              Vista previa del equipo
            </Link>
          )}
        </span>
        <Link href="/biblioteca" className="bib-shorts-round" aria-label="Cerrar los cortos: volver a la biblioteca">
          <Icon>{PATHS.close}</Icon>
        </Link>
      </div>

      <aside className="bib-shorts-side">
        <Link href="/biblioteca" className="bib-crumb">
          ← Biblioteca
        </Link>
        <h1 className={`bib-shorts-side-title ${titleClass}`}>{texts.title}</h1>
        {topicChip}
        <p>{texts.subtitle}</p>
        {staffNote && (
          <p className="bib-shorts-side-note">
            <b>Vista previa del equipo.</b> {staffNote} <Link href="/admin/biblioteca">Ir a Editar biblioteca</Link>
          </p>
        )}
      </aside>

      <div key={round} ref={feed} className="bib-shorts-feed">
        {slides.length === 0 && (
          <section className="bib-short bib-short--card bib-short--end">
            <div className="bib-short-card">
              <span className="bib-short-card-ic">
                <Icon size={26}>{PATHS.shorties}</Icon>
              </span>
              <p>{topic ? `Todavía no hay cortos de ${topic.label}.` : texts.empty}</p>
              <Link href={topic ? CORTOS : "/biblioteca"} className="bib-btn bib-btn-main">
                {topic ? "Ver todos los cortos" : texts.endLibrary}
              </Link>
            </div>
          </section>
        )}
        {slides.map((slide, index) => {
          if (slide.kind === "signup") {
            return (
              <section key={slide.key} className="bib-short bib-short--card" aria-label={texts.signupTitle}>
                <div className="bib-short-card">
                  <span className="bib-short-card-ic">
                    <Icon size={26}>{PATHS.lock}</Icon>
                  </span>
                  <h2 className={titleClass}>{texts.signupTitle}</h2>
                  <p>{texts.signupText}</p>
                  <Link href={signupHref()} className="bib-btn bib-btn-main">
                    {texts.signupButton}
                  </Link>
                  <span className="bib-short-later">
                    <Icon size={18}>{PATHS.up}</Icon>
                    {texts.signupLater}
                  </span>
                </div>
              </section>
            );
          }
          if (slide.kind === "end") {
            return (
              <section key="end" className="bib-short bib-short--card bib-short--end" aria-label={texts.endTitle}>
                <div className="bib-short-card">
                  <span className="bib-short-card-ic">
                    <Icon size={26}>{PATHS.shorties}</Icon>
                  </span>
                  <h2 className={titleClass}>{topic ? `Ya viste los cortos de ${topic.label}` : texts.endTitle}</h2>
                  <p>{topic ? "Puedes verlos otra vez en otro orden o seguir con todos los cortos." : texts.endText}</p>
                  <button type="button" className="bib-btn bib-btn-main" onClick={again}>
                    {texts.endAgain}
                  </button>
                  <Link href={topic ? CORTOS : "/biblioteca"} className="bib-btn bib-btn-ghost">
                    {topic ? "Ver todos los cortos" : texts.endLibrary}
                  </Link>
                </div>
              </section>
            );
          }

          const { item } = slide;
          const { video, products } = item;
          const isActive = index === active;
          const locked = video.gated && !unlocked;
          const broken = failed.includes(video.id);
          const playable = Boolean(video.youtubeId) && !locked && !broken;
          const live = isActive && settled && playable;
          const steered = playable && mode === "api";
          const profileHref = profiles && video.instructor?.slug ? `/instructoras/${video.instructor.slug}` : null;
          const length = video.durationSeconds != null ? formatDuration(video.durationSeconds) : null;
          const theme = themeOf(video.theme);
          const descriptionOpen = openDescription === video.id;
          const longDescription = (video.description?.length ?? 0) > DESCRIPTION_CLAMP;
          const tags = video.tags.filter((t) => topicKey(t) !== video.theme && !video.subcategories.some((s) => s.key === topicKey(t)));
          return (
            <section key={video.id} className="bib-short" aria-label={video.title}>
              <div className="bib-short-frame">
                <div className={`bib-short-media bib-ph-${toneOf(video.slug)}`}>
                  {video.youtubeId && (
                    // eslint-disable-next-line @next/next/no-img-element -- YouTube's still, until its player loads
                    <img src={youtubeThumbnail(video.youtubeId)} alt="" loading={index < 2 ? "eager" : "lazy"} decoding="async" />
                  )}
                  {live && mode !== "plain" && (
                    <ShortPlayer
                      youtubeId={video.youtubeId!}
                      title={video.title}
                      native={mode === "native"}
                      onPlayer={onPlayer}
                      onApiFail={onApiFail}
                      onVideoError={() => setFailed((list) => (list.includes(video.id) ? list : [...list, video.id]))}
                    />
                  )}
                  {live && mode === "plain" && (
                    <div className="bib-short-player">
                      <iframe src={youtubeLoopEmbedUrl(video.youtubeId!)} title={video.title} allow="autoplay; encrypted-media; picture-in-picture; web-share" />
                    </div>
                  )}
                </div>
                {!video.youtubeId && <span className="bib-short-note">Video de ejemplo: aquí irá el video de YouTube</span>}
                {locked && (
                  <div className="bib-short-lock">
                    <span className="bib-lock">
                      <LockIcon />
                      {texts.locked}
                    </span>
                    <Link href={signupHref(video.slug)} className="bib-btn bib-btn-main">
                      {texts.lockedButton}
                    </Link>
                  </div>
                )}
                {broken && (
                  <div className="bib-short-lock">
                    <p>Este video no se puede ver aquí.</p>
                    <a href={`https://www.youtube.com/shorts/${video.youtubeId}`} target="_blank" rel="noopener" className="bib-btn bib-btn-main">
                      Verlo en YouTube
                    </a>
                  </div>
                )}
                {steered && <button type="button" className="bib-short-tap" aria-label={isActive && paused ? "Reproducir" : "Pausar"} onClick={togglePause} />}
                {steered && isActive && paused && (
                  <span className="bib-short-paused" aria-hidden="true">
                    <span>
                      <Icon size={34}>{PATHS.play}</Icon>
                    </span>
                  </span>
                )}
                {steered &&
                  (sound ? (
                    <button type="button" className="bib-short-sound bib-short-sound--on" aria-label="Silenciar" onClick={muteSound}>
                      <Icon size={20}>{PATHS.sound}</Icon>
                    </button>
                  ) : (
                    <button type="button" className="bib-short-sound" onClick={enableSound}>
                      <Icon size={18}>{PATHS.muted}</Icon>
                      {texts.sound}
                    </button>
                  ))}
                <div className="bib-short-info">
                  {video.instructor ? (
                    <span className="bib-short-who">
                      {profileHref ? (
                        <Link href={profileHref}>
                          <b>{video.instructor.name}</b>
                        </Link>
                      ) : (
                        <b>{video.instructor.name}</b>
                      )}{" "}
                      <span>· {video.instructor.city}</span>
                    </span>
                  ) : (
                    video.teachersNote && (
                      <span className="bib-short-who">
                        <b>Con {video.teachersNote}</b>
                      </span>
                    )
                  )}
                  {video.instructor && (
                    <span className="bib-short-seal">
                      <Icon size={13}>{PATHS.check}</Icon>
                      {texts.seal}
                    </span>
                  )}
                  <h2 className="bib-short-title">{video.title}</h2>
                  {video.description && <p className={`bib-short-desc${descriptionOpen ? " is-open" : ""}`}>{video.description}</p>}
                  {longDescription && (
                    <button type="button" className="bib-short-more" aria-expanded={descriptionOpen} onClick={() => setOpenDescription(descriptionOpen ? null : video.id)}>
                      {descriptionOpen ? "Ver menos" : "Ver más"}
                    </button>
                  )}
                  <span className="bib-short-tags">
                    {video.sample && <SampleBadge />}
                    <Link href={`${CORTOS}?tema=${theme.key}`} className="bib-short-topic" aria-current={topic?.key === theme.key ? "true" : undefined}>
                      {theme.label}
                    </Link>
                    {video.subcategories.map((sub) => (
                      <Link key={sub.key} href={`${CORTOS}?tema=${sub.key}`} className="bib-short-topic" aria-current={topic?.key === sub.key ? "true" : undefined}>
                        {sub.name}
                      </Link>
                    ))}
                    {tags.map((tag) => (
                      <Link key={tag} href={`${CORTOS}?tema=${topicKey(tag)}`} className="bib-short-topic" aria-current={topic?.key === topicKey(tag) ? "true" : undefined}>
                        {tag}
                      </Link>
                    ))}
                    {length && <span>{length}</span>}
                  </span>
                </div>
                {index === 0 && !scrolled && slides.length > 2 && (
                  <span className="bib-short-hint" aria-hidden="true">
                    <Icon size={18}>{PATHS.up}</Icon>
                    {texts.hint}
                  </span>
                )}
              </div>
              <div className="bib-short-rail">
                {profileHref && video.instructor && (
                  <Link href={profileHref} className="bib-short-act">
                    <Avatar person={video.instructor} className="bib-short-face" />
                    <small>{texts.profile}</small>
                  </Link>
                )}
                {showUsed && products.length > 0 && (
                  <button type="button" className="bib-short-act" onClick={(e) => openSheet(item, e.currentTarget)}>
                    <span className="bib-short-btn">
                      <Icon>{PATHS.bag}</Icon>
                    </span>
                    <small>{texts.used}</small>
                  </button>
                )}
                {showSteps && item.hasSteps && (
                  <Link href={`/biblioteca/${video.slug}#paso-a-paso`} className="bib-short-act">
                    <span className="bib-short-btn">
                      <Icon>{PATHS.steps}</Icon>
                    </span>
                    <small>{texts.steps}</small>
                  </Link>
                )}
                <button type="button" className="bib-short-act" onClick={() => share(item)}>
                  <span className="bib-short-btn">
                    <Icon>{PATHS.share}</Icon>
                  </span>
                  <small>{texts.share}</small>
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {slides.length > 1 && (
        <div className="bib-shorts-nav">
          <button type="button" aria-label="Video anterior" disabled={active === 0} onClick={() => goTo(active - 1)}>
            <Icon size={24}>{PATHS.up}</Icon>
          </button>
          <button type="button" aria-label="Video siguiente" disabled={active >= slides.length - 1} onClick={() => goTo(active + 1)}>
            <Icon size={24}>{PATHS.down}</Icon>
          </button>
        </div>
      )}

      {sheetItem && (
        <div className="bib-sheet-scrim" onClick={closeSheet}>
          <div className="bib-sheet" role="dialog" aria-modal="true" aria-label={texts.usedTitle} onClick={(e) => e.stopPropagation()}>
            <span className="bib-sheet-handle" aria-hidden="true" />
            <div className="bib-sheet-head">
              <div>
                <h2 className={titleClass}>{texts.usedTitle}</h2>
                {sheetDiscounted && <p>{texts.usedSubtitle}</p>}
              </div>
              <button ref={sheetClose} type="button" className="bib-drawer-close" aria-label="Cerrar" onClick={closeSheet}>
                <Icon size={18}>{PATHS.close}</Icon>
              </button>
            </div>
            <UsedProducts products={sheetItem.products} buyLabel={texts.buy} />
            {showSteps && sheetItem.hasSteps && (
              <Link href={`/biblioteca/${sheetItem.video.slug}#paso-a-paso`} className="bib-btn bib-btn-line">
                <Icon size={18}>{PATHS.steps}</Icon>
                {texts.stepsLink}
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
