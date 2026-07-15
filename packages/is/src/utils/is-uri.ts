import { isString } from "./is-string.js";
import { isUrn } from "./is-urn.js";

// A URI usable as an identifier (an OIDC/OAuth `iss`, for one): a real URL with an
// authority (`https://…`, `http://…`) OR a URN (`urn:…`).
//
// Deliberately STRICTER than `isUrlLike`: `new URL` accepts any `scheme:x`, so
// `isUrlLike("foo:bar")` and `isUrlLike("urn:x:y")` are both true. That is too
// loose for an issuer — `foo:bar` has no authority and is not a URN. Here the
// authority check (a non-empty host) rejects it, and `isUrn` accepts a genuine
// URN, which has no authority.
export const isUri = (input?: any): input is string => {
  if (!isString(input)) return false;
  if (isUrn(input)) return true;

  try {
    return new URL(input).host.length > 0;
  } catch {
    return false;
  }
};
