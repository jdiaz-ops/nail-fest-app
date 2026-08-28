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
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      iframe: ["src", "width", "height", "allowfullscreen", "frameborder"],
      span: ["style"],
      p: ["style"],
      "*": ["class"],
    },
    // Text alignment / color come through as inline style on span/p (see
    // RichTextEditor.tsx's TextAlign/Color extensions) — only allow the
    // exact properties those extensions emit, nothing else.
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(.*\)$/],
        "text-align": [/^left$|^center$|^right$|^justify$/],
      },
    },
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "player.vimeo.com"],
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}
