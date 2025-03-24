/**
 * RFC 7230 sec 3.2
 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 * field-vchar   = VCHAR / obs-text
 * obs-text      = %x80-FF
 */
// eslint-disable-next-line no-control-regex
export const FIELD_CONTENT_REG_EXP = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

export const ESCAPE_CHARS_REGEXP = /[\^$\\.*+?()[\]{}|]/g;

export const PRIORITY_REGEXP = /^(?:low|medium|high)$/i;

export const RESTRICTED_NAME_CHARS_REGEXP = /[;=]/;

export const RESTRICTED_NAMES_REGEXP =
  /^(?:domain|expires|max-age|path|secure|httponly|samesite|priority|partitioned)$/i;

export const RESTRICTED_VALUE_CHARS_REGEXP = /[;]/;

export const SAME_SITE_REGEXP = /^(?:lax|none|strict)$/i;
