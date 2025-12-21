// ═══════════════════════════════════════════════════════════════════════════
// HTML Sanitization
// Server-safe HTML sanitization for email content
// ═══════════════════════════════════════════════════════════════════════════
//
// This module provides HTML sanitization that works on both client and server.
// It uses a whitelist-based approach to filter HTML tags and attributes.
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Allowed HTML tags for email display
 */
const ALLOWED_TAGS = new Set([
  // Text formatting
  "p",
  "br",
  "span",
  "div",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  // Lists
  "ul",
  "ol",
  "li",
  // Links and images
  "a",
  "img",
  // Tables (common in emails)
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  // Quotes and code
  "blockquote",
  "pre",
  "code",
  // Other
  "hr",
  "sub",
  "sup",
  "font",
  "center",
]);

/**
 * Allowed HTML tags for composing emails (more restrictive)
 */
const ALLOWED_TAGS_COMPOSE = new Set([
  "p",
  "br",
  "span",
  "div",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
]);

/**
 * Allowed attributes per tag
 */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  "*": new Set(["id", "class", "style", "title", "dir"]),
  a: new Set(["href", "target", "rel", "title"]),
  img: new Set(["src", "alt", "width", "height", "title"]),
  table: new Set(["border", "cellpadding", "cellspacing", "width"]),
  td: new Set(["colspan", "rowspan", "align", "valign", "width"]),
  th: new Set(["colspan", "rowspan", "align", "valign", "width"]),
  tr: new Set(["align", "valign"]),
  font: new Set(["color", "size", "face"]),
};

/**
 * Dangerous attribute patterns that should always be removed
 */
const DANGEROUS_ATTRS = /^on\w+|^data-|^xmlns/i;

/**
 * Dangerous URL protocols
 */
const DANGEROUS_PROTOCOLS = /^(javascript|vbscript|data(?!:image)|file):/i;

/**
 * Safe URL protocols for href/src attributes
 */
const SAFE_PROTOCOLS = /^(https?|mailto|tel|#)/i;

// ─────────────────────────────────────────────────────────────
// Core Sanitization Logic
// ─────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Decode HTML entities for URL checking
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#x2F;/gi, "/");
}

/**
 * Check if a URL is safe
 */
function isSafeUrl(url: string): boolean {
  const decoded = decodeHtmlEntities(url.trim().toLowerCase());

  // Block dangerous protocols
  if (DANGEROUS_PROTOCOLS.test(decoded)) {
    return false;
  }

  // Allow safe protocols and relative URLs
  if (
    SAFE_PROTOCOLS.test(decoded) ||
    decoded.startsWith("/") ||
    !decoded.includes(":")
  ) {
    return true;
  }

  // Allow data:image for inline images
  if (decoded.startsWith("data:image/")) {
    return true;
  }

  return false;
}

/**
 * Sanitize a single attribute
 */
function sanitizeAttribute(
  tagName: string,
  attrName: string,
  attrValue: string
): string | null {
  const lowerAttrName = attrName.toLowerCase();

  // Block dangerous attributes
  if (DANGEROUS_ATTRS.test(lowerAttrName)) {
    return null;
  }

  // Check if attribute is allowed for this tag
  const tagAttrs = ALLOWED_ATTRS[tagName.toLowerCase()];
  const globalAttrs = ALLOWED_ATTRS["*"];

  const isAllowed =
    globalAttrs?.has(lowerAttrName) || tagAttrs?.has(lowerAttrName);

  if (!isAllowed) {
    return null;
  }

  // Special handling for URL attributes
  if (lowerAttrName === "href" || lowerAttrName === "src") {
    if (!isSafeUrl(attrValue)) {
      return null;
    }
  }

  // Sanitize style attribute (remove expressions, urls)
  if (lowerAttrName === "style") {
    const sanitizedStyle = attrValue
      .replace(/expression\s*\([^)]*\)/gi, "")
      .replace(/url\s*\([^)]*\)/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/behavior:/gi, "");
    return `${attrName}="${escapeHtml(sanitizedStyle)}"`;
  }

  return `${attrName}="${escapeHtml(attrValue)}"`;
}

/**
 * Sanitize HTML content
 */
function sanitizeHtmlCore(
  html: string,
  allowedTags: Set<string>,
  options: { addTargetBlank?: boolean } = {}
): string {
  let result = html;

  // Remove script and style tags completely (including content)
  result = result.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );
  result = result.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    ""
  );

  // Remove comments
  result = result.replace(/<!--[\s\S]*?-->/g, "");

  // Process tags
  result = result.replace(
    /<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi,
    (match, tagName: string, attrs: string) => {
      const lowerTagName = tagName.toLowerCase();

      // Check if tag is allowed
      if (!allowedTags.has(lowerTagName)) {
        return ""; // Remove disallowed tag
      }

      // Process closing tags
      if (match.startsWith("</")) {
        return `</${lowerTagName}>`;
      }

      // Process attributes
      const sanitizedAttrs: string[] = [];

      // Parse attributes
      const attrRegex =
        /([a-z][a-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
      let attrMatch;

      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        const [, attrName, value1, value2, value3] = attrMatch;
        const attrValue = value1 ?? value2 ?? value3 ?? "";

        const sanitizedAttr = sanitizeAttribute(
          lowerTagName,
          attrName,
          attrValue
        );
        if (sanitizedAttr) {
          sanitizedAttrs.push(sanitizedAttr);
        }
      }

      // Add target="_blank" and rel="noopener noreferrer" to links
      if (lowerTagName === "a" && options.addTargetBlank) {
        if (!sanitizedAttrs.some((a) => a.startsWith("target="))) {
          sanitizedAttrs.push('target="_blank"');
        }
        if (!sanitizedAttrs.some((a) => a.startsWith("rel="))) {
          sanitizedAttrs.push('rel="noopener noreferrer"');
        }
      }

      // Handle self-closing tags
      const selfClosing = ["br", "hr", "img"].includes(lowerTagName);
      const attrString =
        sanitizedAttrs.length > 0 ? " " + sanitizedAttrs.join(" ") : "";

      return selfClosing
        ? `<${lowerTagName}${attrString} />`
        : `<${lowerTagName}${attrString}>`;
    }
  );

  return result;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Sanitize HTML email content for safe display
 * Use this when displaying email HTML from external sources
 */
export function sanitizeEmailHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtmlCore(html, ALLOWED_TAGS, { addTargetBlank: true });
}

/**
 * Sanitize HTML for composing/drafting emails
 * More restrictive than display sanitization
 */
export function sanitizeComposeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtmlCore(html, ALLOWED_TAGS_COMPOSE);
}

/**
 * Strip all HTML, returning plain text
 * Use when you need text-only content
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";

  // Remove tags
  let text = html.replace(/<[^>]*>/g, "");

  // Decode entities
  text = decodeHtmlEntities(text);

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Check if HTML contains potentially dangerous content
 * Returns true if sanitization changed the content significantly
 */
export function containsDangerousHtml(
  html: string | null | undefined
): boolean {
  if (!html) return false;

  // Quick checks for common dangerous patterns
  const dangerousPatterns = [
    /<script\b/i,
    /<style\b/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<form\b/i,
    /\bon\w+\s*=/i,
    /javascript:/i,
    /vbscript:/i,
    /expression\s*\(/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(html));
}

/**
 * Sanitize email content and add safety attributes to links
 * Convenience function that does both sanitization and link safety
 */
export function sanitizeAndSecureLinks(
  html: string | null | undefined
): string {
  return sanitizeEmailHtml(html);
}
