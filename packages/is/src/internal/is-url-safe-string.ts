// ASCII whitespace and control characters: U+0000–U+0020 (the C0 controls plus
// space) and U+007F (DEL). The WHATWG URL parser is LENIENT about exactly this
// band — it DELETES tab (U+0009), LF (U+000A) and CR (U+000D) from anywhere in
// the input and trims leading/trailing C0 controls and space, then parses what
// survives. So `new URL` reports on a string it has silently rewritten, and a
// guard that validates the PARSE blesses a value the caller never holds:
// `isHttpUrl("https://exa\nmple.com")` was true while the parse said
// `https://example.com/`.
//
// Since these guards gate issuer matching and redirect-uri allowlists, the
// value that was validated and the value that gets stored or string-compared
// must be the same value. Rejecting the whole band uniformly — anywhere in the
// string, not only at the ends — is simpler than encoding the parser's
// positional rules, and rejects nothing legal: RFC 3986 requires every one of
// these percent-encoded.
//
// Deliberately NOT a `new URL(input).href === input` round-trip. The parser also
// NORMALISES well-formed input (appends a trailing slash, lowercases scheme and
// host, punycodes an IDN, drops a default port), so a round-trip test would
// reject `http://localhost:3000` and `HTTPS://Tyr.Lindorm.IO`. The silent
// DELETIONS are the bug; the normalisations are legitimate.
//
// Internal: `src/index.ts` re-exports `utils/` only, so this stays private.
// eslint-disable-next-line no-control-regex
const WHITESPACE_OR_CONTROL_REGEX = /[\u0000-\u0020\u007f]/;

export const isUrlSafeString = (input: string): boolean =>
  !WHITESPACE_OR_CONTROL_REGEX.test(input);
