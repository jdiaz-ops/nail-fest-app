import sanitizeHtml from "sanitize-html";

// The event Description rich-text editor (RichTextEditor.tsx, TipTap)
// only ever produces this shape of HTML — this is an allowlist, not a
// blocklist, so anything TipTap can't produce gets stripped regardless
// of how the request got to the server (the admin UI, or a direct API
// call). The description renders back out on the public, unauthenticated
// event page via dangerouslySetInnerHTML — this is the one thing standing
// between that and stored XSS.
export function sanitizeEventDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "iframe",
      "hr",
      "span",
      "blockquote",
      "figure",
      "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      // "style" here is what keeps the image responsive EVERYWHERE the
      // HTML ends up — including a confirmation email, which never loads
      // globals.css's own `.event-description img { max-width: 100% }`
      // rule (that only ever applies on the public event page itself).
      // See RichTextEditorImage.tsx's renderHTML, the one place that
      // emits it.
      img: ["src", "alt", "width", "height", "style"],
      iframe: ["src", "width", "height", "allowfullscreen", "frameborder"],
      span: ["style"],
      p: ["style"],
      // "data-align" is RichTextEditorImage.tsx's image position
      // (none/left/center/right) — the public event page reads it via
      // globals.css's `.event-description figure.tiptap-image[data-align=...]`.
      figure: ["data-align"],
      "*": ["class"],
    },
    // Text alignment / color come through as inline style on span/p (see
    // RichTextEditor.tsx's TextAlign/Color extensions); max-width/height/
    // border-radius on img are the fixed values RichTextEditorImage.tsx's
    // renderHTML always emits (see its own comment) — only allow the
    // exact properties/values each of those actually produces, nothing else.
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(.*\)$/],
        "text-align": [/^left$|^center$|^right$|^justify$/],
      },
      img: {
        "max-width": [/^100%$/],
        height: [/^auto$/],
        "border-radius": [/^\d+px$/],
      },
    },
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "player.vimeo.com"],
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}
