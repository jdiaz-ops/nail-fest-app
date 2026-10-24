"use client";

import { useState } from "react";
import Link from "next/link";
import { showCuponeraNotice } from "@/components/cuponera/PreviewLink";
import { youtubeEmbedUrl, youtubeThumbnail } from "@/lib/library/shared";
import { LockIcon, PlayIcon } from "./parts";

// The video on its page: YouTube's still until it's played, then the
// privacy-enhanced YouTube player (no YouTube cookies before the play). A
// recording behind the free sign-up shows its padlock and the way in; an
// invented example only explains.
export default function VideoPlayer({
  youtubeId,
  title,
  wide,
  tone,
  durationLabel,
  locked,
  lockedLabel,
  signupHref,
  signupButton,
}: {
  youtubeId: string | null;
  title: string;
  wide: boolean;
  tone: number;
  durationLabel: string | null;
  locked: boolean;
  lockedLabel: string;
  signupHref: string;
  signupButton: string;
}) {
  const [playing, setPlaying] = useState(false);
  const className = `bib-player${wide ? " bib-player--wide" : ""}`;

  if (playing && youtubeId) {
    return (
      <div className={className}>
        <iframe
          src={youtubeEmbedUrl(youtubeId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={`${className} bib-ph-${tone}`}>
      {youtubeId && (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube's still
        <img src={youtubeThumbnail(youtubeId)} alt="" />
      )}
      {locked ? (
        <div className="bib-player-lock">
          <span className="bib-lock">
            <LockIcon />
            {lockedLabel}
          </span>
          <Link href={signupHref} className="bib-btn bib-btn-main">
            {signupButton}
          </Link>
        </div>
      ) : (
        <button
          type="button"
          className="bib-player-play"
          aria-label={`Ver «${title}»`}
          onClick={() => (youtubeId ? setPlaying(true) : showCuponeraNotice("Video de ejemplo: aquí se verá el video de YouTube de la instructora."))}
        >
          <span>
            <PlayIcon size={26} />
          </span>
        </button>
      )}
      {durationLabel && <span className="bib-player-dur">{durationLabel}</span>}
    </div>
  );
}
