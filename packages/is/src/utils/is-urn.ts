import { isString } from "./is-string.js";

// RFC 8141: `urn:<NID>:<NSS>`. The `urn` scheme and the NID are case-insensitive;
// the NID is an alphanumeric-led run of `[a-z0-9-]` (capped at 32), and the NSS is
// the non-empty remainder.
const URN_REGEX = /^urn:[a-z0-9][a-z0-9-]{0,31}:.+/i;

export const isUrn = (input?: any): input is string =>
  isString(input) && URN_REGEX.test(input);
