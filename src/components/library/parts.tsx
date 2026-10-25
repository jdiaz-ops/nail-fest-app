import type { ReactNode } from "react";
import Link from "next/link";
import {
  VIEWS_SHOWN_FROM,
  formatDuration,
  formatLength,
  formatViews,
  themeOf,
  toneOf,
  youtubeThumbnail,
  type InstructorCard,
  type LibraryPerson,
  type LibraryThemeIcon,
  type LibraryVideoCard,
} from "@/lib/library/shared";

// The small pieces the library's and the instructors' pages share — the
// same look as the approved mockups of 2026-10-24.

export function SampleBadge() {
  return <span className="bib-sample">Ejemplo</span>;
}

export function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ThemeIcon({ icon }: { icon: LibraryThemeIcon }) {
  const props = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (icon) {
    case "brush":
      return (
        <svg {...props}>
          <path d="M15 4l5 5-9 9H6v-5z" />
          <path d="M13 6l5 5" />
        </svg>
      );
    case "coin":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v10M14.5 9.5c-.4-.9-1.3-1.3-2.5-1.3-1.5 0-2.5.7-2.5 1.8 0 2.6 5 1.4 5 4 0 1.1-1 1.8-2.5 1.8-1.3 0-2.2-.5-2.6-1.4" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "bottle":
      return (
        <svg {...props}>
          <rect x="7" y="10" width="10" height="11" rx="2" />
          <path d="M10 10V6h4v4" />
          <path d="M11 3h2v3h-2z" />
        </svg>
      );
    case "warning":
      return (
        <svg {...props}>
          <path d="M12 4l9 16H3z" />
          <path d="M12 10v4M12 17v.5" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...props}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
        </svg>
      );
    case "star":
      return (
        <svg {...props}>
          <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
        </svg>
      );
    case "person":
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
        </svg>
      );
  }
}

/** A video's still: YouTube's own, or a gradient for the examples. In an
 * upright card, a lying video (16:9) shows whole, over its own blurred still. */
export function VideoThumb({ video, className = "bib-thumb", showViews = true }: { video: LibraryVideoCard; className?: string; showViews?: boolean }) {
  const boxed = className === "bib-thumb" && !video.vertical;
  return (
    <div className={`${className}${boxed ? " bib-thumb--boxed" : ""} bib-ph-${toneOf(video.slug)}`}>
      {video.youtubeId && boxed && (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube's still, blurred behind the whole one
        <img className="bib-thumb-back" src={youtubeThumbnail(video.youtubeId)} alt="" loading="lazy" decoding="async" />
      )}
      {video.youtubeId && (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube's still, a remote image next/image isn't set up for
        <img src={youtubeThumbnail(video.youtubeId)} alt="" loading="lazy" decoding="async" />
      )}
      <span className="bib-thumb-play">
        <span>
          <PlayIcon />
        </span>
      </span>
      {showViews && video.views >= VIEWS_SHOWN_FROM && <span className="bib-thumb-views">{formatViews(video.views)}</span>}
      {video.durationSeconds != null && <span className="bib-thumb-dur">{formatDuration(video.durationSeconds)}</span>}
    </div>
  );
}

function byline(video: LibraryVideoCard): string {
  return [video.instructor?.name ?? video.teachersNote, themeOf(video.theme).label].filter(Boolean).join(" · ");
}

/** A video's card: to its page, or wherever `href` says (the scroll of its list). */
export function VideoCard({ video, href }: { video: LibraryVideoCard; href?: string }) {
  return (
    <Link href={href ?? `/biblioteca/${video.slug}`} className="bib-vcard">
      <VideoThumb video={video} />
      <span className="bib-vcard-title">{video.title}</span>
      <small>
        {video.sample && <SampleBadge />}
        {byline(video)}
      </small>
    </Link>
  );
}

/** A video as a line of the search results. */
export function VideoRow({ video, title, href }: { video: LibraryVideoCard; title: ReactNode; href?: string }) {
  const parts = [video.instructor?.name ?? video.teachersNote, themeOf(video.theme).label, video.subcategories[0]?.name];
  if (video.durationSeconds != null) parts.push(video.kind === "maraton" ? formatLength(video.durationSeconds) : formatDuration(video.durationSeconds));
  return (
    <Link href={href ?? `/biblioteca/${video.slug}`} className="bib-row">
      <VideoThumb video={video} className={video.vertical ? "bib-mini" : "bib-mini bib-mini--wide"} showViews={false} />
      <span className="bib-row-text">
        <span className="bib-row-title">{title}</span>
        <small>
          {video.sample && <SampleBadge />}
          {parts.filter(Boolean).join(" · ")}
        </small>
      </span>
    </Link>
  );
}

export function RecordingCard({ video, lockedLabel, locked, href }: { video: LibraryVideoCard; lockedLabel: string; locked: boolean; href?: string }) {
  const details = [video.durationSeconds != null ? formatLength(video.durationSeconds) : null, video.teachersNote ?? video.instructor?.name].filter(Boolean);
  return (
    <Link href={href ?? `/biblioteca/${video.slug}`} className="bib-mcard">
      <div className={`bib-mcard-media bib-ph-${toneOf(video.slug)}`}>
        {video.youtubeId && (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube's still
          <img src={youtubeThumbnail(video.youtubeId)} alt="" loading="lazy" decoding="async" />
        )}
        {locked && (
          <span className="bib-lock">
            <LockIcon />
            {lockedLabel}
          </span>
        )}
      </div>
      <span className="bib-mcard-body">
        <span className="bib-mcard-title">{video.title}</span>
        <small>
          {video.sample && <SampleBadge />}
          {details.join(" · ")}
        </small>
      </span>
    </Link>
  );
}

/** A face: her photo, or her initial on her gradient. */
export function Avatar({ person, className }: { person: Pick<LibraryPerson, "initial" | "photoUrl" | "tone">; className: string }) {
  return (
    <span className={`${className} bib-ph-${person.tone}`} aria-hidden="true">
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- photo uploaded in the admin (Vercel Blob)
        <img src={person.photoUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        person.initial
      )}
    </span>
  );
}

export function PeopleRow({ people }: { people: InstructorCard[] }) {
  return (
    <div className="bib-people">
      {people.map((p) => (
        <Link key={p.id} href={`/instructoras/${p.slug}`} className="bib-person">
          <Avatar person={p} className="bib-person-face" />
          <b>{p.name}</b>
          <small>{p.city}</small>
        </Link>
      ))}
    </div>
  );
}

/** An instructor's card in the directory; her video count only while El Taller is public. */
export function InstructorTile({ instructor, featuredLabel, showVideos }: { instructor: InstructorCard; featuredLabel: string; showVideos: boolean }) {
  const meta = showVideos ? [instructor.videoCount === 1 ? "1 video" : `${instructor.videoCount} videos`] : [];
  return (
    <Link href={`/instructoras/${instructor.slug}`} className="bib-icard">
      <span className="bib-icard-photo">
        <Avatar person={instructor} className="bib-icard-face" />
        {instructor.featured && <span className="bib-badge bib-badge--top">{featuredLabel}</span>}
      </span>
      <span className="bib-icard-body">
        <span className="bib-icard-name">{instructor.name}</span>
        <small className="bib-icard-city">
          {instructor.sample && <SampleBadge />}
          {instructor.city}
          {instructor.online ? " · también en línea" : ""}
        </small>
        {instructor.specialties.length > 0 && (
          <span className="bib-tags">
            {instructor.specialties.slice(0, 3).map((s) => (
              <span key={s} className="bib-tag">
                {s}
              </span>
            ))}
          </span>
        )}
        {meta.length > 0 && <small className="bib-icard-meta">{meta.join(" · ")}</small>}
      </span>
    </Link>
  );
}

export function SearchForm({ action, placeholder, defaultValue, label }: { action: string; placeholder: string; defaultValue?: string; label: string }) {
  return (
    <form className="bib-search" role="search" action={action} method="get">
      <SearchIcon />
      <label htmlFor="bib-q" className="bib-sr">
        {label}
      </label>
      <input id="bib-q" name="q" type="search" placeholder={placeholder} defaultValue={defaultValue} enterKeyHint="search" autoComplete="off" />
    </form>
  );
}
