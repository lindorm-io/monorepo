import { isUrlSafeString } from "../internal/is-url-safe-string.js";
import { isString } from "./is-string.js";

// A URL a LOCATION can be derived from, or fetched: `http:` or `https:`, with a
// host. Ask this wherever a value is resolved against (`new URL(path, value)`)
// or requested over the wire.
//
// Narrower than `isUri` on purpose, and they answer different questions. `isUri`
// asks whether a value is a legal IDENTIFIER — a URN is, and so is
// `ftp://example.com` — but neither says where to fetch anything. Resolving
// `/.well-known/jwks.json` against `ftp://example.com` yields a syntactically
// valid URL nobody can fetch, so a site that derives a location asks this
// instead. An identifier may still be a URN; deriving a location from it cannot.
//
// The host is guaranteed by the parse, not re-checked: `http`/`https` are WHATWG
// "special" schemes, so `new URL` requires an authority and throws without one
// (`http://` and `http://:8080` both throw).
export const isHttpUrl = (input?: any): input is string => {
  if (!isString(input)) return false;
  if (!isUrlSafeString(input)) return false;

  try {
    const { protocol } = new URL(input);

    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};
