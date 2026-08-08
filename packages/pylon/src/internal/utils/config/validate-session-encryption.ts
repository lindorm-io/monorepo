import { isUndefined } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import { PylonError } from "../../../errors/PylonError.js";
import type { PylonSettings } from "../../../types/index.js";
import { resolveSessionKeys } from "../keys/resolve-session-keys.js";

/**
 * A session-enabled deployment must not reach plaintext tokens by SILENCE.
 *
 * The encryption key resolves as `auth.session.encryption ?? cookies.encryption`
 * (see `resolveSessionKeys`) — naming one key on `cookies` covers everything, and
 * that convenience is intact here: an inherited key resolves and this check is
 * satisfied. What is reported is the case where NEITHER names one.
 *
 * The severity splits on whether a `kv` source exists, because that decides what
 * the cookie holds:
 *
 * - **No `kv` ⇒ THROWS.** `createSessionStore` returns nothing without a source,
 *   so `httpSessionMiddleware` writes the WHOLE session object into the cookie
 *   where it would otherwise write a store id — access token, id token and
 *   refresh token, base64url ENCODED, not encrypted. That is working bearer
 *   credentials sitting in the browser's cookie jar and re-sent on every request,
 *   readable by anything that can read the jar. There is no degraded mode to run
 *   in, so it fails at boot.
 * - **`kv` configured ⇒ WARNS once.** The cookie carries only an opaque id; the
 *   tokens are at rest in a store that already has an access boundary of its own.
 *   Plaintext there is a real weakness and a deployment should know, but it is a
 *   workable deployment — the same test `validateAuthSettings` applies.
 *
 * ⚠ ONCE. Called from `Pylon.setup()`, never from a request path — a per-request
 * warning about static configuration is noise that teaches people to filter
 * warnings.
 */
export const validateSessionEncryption = (
  options: Pick<PylonSettings, "auth" | "cookies" | "kv">,
  logger: ILogger,
): void => {
  // Sessions off ⇒ no tokens to seal.
  if (isUndefined(options.auth?.session)) return;

  const { encryption } = resolveSessionKeys(options.auth.session, options.cookies);

  // A key resolves, on either tier. Nothing to say.
  if (!isUndefined(encryption)) return;

  if (options.kv) {
    logger.warn(
      "Session tokens are stored unencrypted; name auth.session.encryption or cookies.encryption to seal them at rest",
    );
    return;
  }

  throw new PylonError("Cookie-only sessions require an encryption key", {
    code: "session_encryption_not_configured",
    title: "Session Encryption Not Configured",
    details:
      "auth.session is enabled with no `kv` source, so the whole session — access token, id token and refresh token — travels in the session cookie, base64url encoded rather than encrypted. Name a key on `auth.session.encryption` or on `cookies.encryption`, or configure a `kv` source so the cookie carries only a store id.",
  });
};
