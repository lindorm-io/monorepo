import { isString } from "./is-string.js";

// RFC 8141: `urn:<NID>:<NSS>`. The `urn` scheme and the NID are case-insensitive;
// the NID is an alphanumeric-led run of `[a-z0-9-]` (capped at 32), and the NSS is
// the non-empty remainder.
//
// The NSS is built from pchar, so ASCII whitespace and control characters —
// U+0000–U+0020 and U+007F — are illegal raw and must be percent-encoded. The
// class excludes them and the match is anchored at both ends, which matters
// beyond pedantry: `isUri` answers through this guard, and a URN carrying a
// tab/LF/CR loses it silently the moment a consumer hands it to `new URL`
// (`urn:a:b\nc` parses as `urn:a:bc`), so a validated value would not be the
// value that was validated. Unanchored `.+` used to accept exactly that.
// eslint-disable-next-line no-control-regex
const URN_REGEX = /^urn:[a-z0-9][a-z0-9-]{0,31}:[^\u0000-\u0020\u007f]+$/i;

export const isUrn = (input?: any): input is string =>
  isString(input) && URN_REGEX.test(input);
