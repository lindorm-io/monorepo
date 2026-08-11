import { isUndefined } from "@lindorm/is";
import { PylonError } from "../../../errors/PylonError.js";
import type { PylonSettings } from "../../../types/index.js";
import { resolveSessionKeys } from "../keys/resolve-session-keys.js";

/**
 * A session-enabled deployment must not reach an unsealed session cookie by SILENCE.
 *
 * The encryption key resolves as `auth.session.encryption ?? cookies.encryption`
 * (see `resolveSessionKeys`) — naming one key on `cookies` covers everything, and
 * that convenience is intact here: an inherited key resolves and this check is
 * satisfied. What is reported is the case where NEITHER names one.
 *
 * ONE severity, both modes: a missing key is a boot failure. The severity used to
 * split on whether a `kv` source existed, because that decided what the cookie
 * held — the whole token set without a store, an opaque id with one. That split no
 * longer describes anything. A kv-backed session cookie now carries `{ id, sec }`,
 * and `sec` is the DECRYPTION KEY for the stored payload; unsealed, it sits in the
 * browser jar and in every proxy or access log that dumps `Cookie` headers. The
 * cookie-only case is unchanged and still fatal: the cookie IS the token set.
 *
 * Sealing does not stop replay — the browser sends the sealed value and pylon opens
 * it — but it stops the secret being READ out of a captured header.
 *
 * ⚠ Called from `Pylon.setup()`, never from a request path. Static configuration is
 * checked once, where a deployment can still be stopped.
 */
export const validateSessionEncryption = (
  options: Pick<PylonSettings, "auth" | "cookies" | "kv">,
): void => {
  // Sessions off ⇒ no session cookie to seal.
  if (isUndefined(options.auth?.session)) return;

  const { encryption } = resolveSessionKeys(options.auth.session, options.cookies);

  // A key resolves, on either tier. Nothing to say.
  if (!isUndefined(encryption)) return;

  throw new PylonError("Sessions require an encryption key", {
    code: "session_encryption_not_configured",
    title: "Session Encryption Not Configured",
    details: options.kv
      ? "auth.session is enabled with a `kv` source, so the session cookie carries `{ id, sec }` — and `sec` is the key that decrypts the stored session. Unsealed, that key travels base64url ENCODED rather than encrypted, in the browser's cookie jar and in any log that captures `Cookie` headers. Name a key on `auth.session.encryption` or on `cookies.encryption`."
      : "auth.session is enabled with no `kv` source, so the whole session — access token, id token and refresh token — travels in the session cookie, base64url encoded rather than encrypted. Name a key on `auth.session.encryption` or on `cookies.encryption`, or configure a `kv` source.",
  });
};
