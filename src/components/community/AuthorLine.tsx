import Link from "next/link";
import type { ConsultorioAuthorView } from "@/lib/community/data";
import { INSIGNIA } from "@/lib/community/consultorio";

const STAR = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />
  </svg>
);

/** Who wrote it: her face, name and city, and what she's earned — the
 * directory's badge with her profile, the team's, the insignia. */
export default function AuthorLine({ author, when }: { author: ConsultorioAuthorView; when?: string }) {
  return (
    <div className="cs-author">
      <span className={`cs-face${author.kind === "TEAM" ? " cs-face--team" : ` bib-ph-${author.tone}`}`} aria-hidden="true">
        {author.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- her own photo (Vercel Blob)
          <img src={author.photoUrl} alt="" />
        ) : (
          author.initial
        )}
      </span>
      <span className="cs-author-text">
        <span className="cs-author-line">
          <b>{author.name}</b>
          {author.city && <span>{author.city}</span>}
          {when && <span>· {when}</span>}
        </span>
        {(author.kind === "TEAM" || author.instructor || author.insignia) && (
          <span className="cs-author-line">
            {author.kind === "TEAM" && <span className="cs-pill cs-pill--team">Equipo Nail Fest</span>}
            {author.instructor && <span className="cs-pill cs-pill--pro">Instructora del directorio</span>}
            {author.insignia && (
              <span className="cs-pill cs-pill--insignia">
                {STAR}
                {INSIGNIA.label}
              </span>
            )}
            {author.profileSlug && <Link href={`/instructoras/${author.profileSlug}`}>Ver su perfil</Link>}
          </span>
        )}
      </span>
    </div>
  );
}
