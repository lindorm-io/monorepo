import { applyKeyFloor, type IAmphora } from "@lindorm/amphora";
import { ServerError } from "@lindorm/errors";
import type { IKryptos } from "@lindorm/kryptos";
import { Predicated } from "@lindorm/utils";
import type { PylonSignKey } from "../../../types/index.js";
import { COOKIE_SIGN_FLOOR } from "../../constants/key-floor.js";

/**
 * Resolve the key that signs a cookie, keeping the two jobs a predicate can do
 * strictly apart (only one of them survives key injection):
 *
 *   FLOOR     — policy. Checked on the key, whatever its provenance.
 *   PREDICATE — a vault query. Checked on nothing; it only ever selects.
 *
 * An injected `kryptos` never came from the vault, so the predicate cannot apply
 * to it — but the FLOOR does, or a key with no private half would be handed to
 * the signer. There is no fallback: a key either satisfies the policy or it does
 * not, and a miss is a throw.
 *
 * The selector is REQUIRED, and it is per-cookie: the caller hands over the key
 * the cookie itself names, or the deployment's `keys.cookie.signature`. Falling
 * back to the floor alone would query the vault's default set — the PUBLISHED
 * keys — and return whichever is newest: in a pylon that is the JWKS token key,
 * because token keys rotate twice as often as cookie keys. That is not a
 * hypothetical; it is the bug this option exists to remove, and a purposeless
 * fallback is worse than a loud failure.
 */
export const resolveCookieSigningKey = async (
  amphora: IAmphora,
  key: PylonSignKey | undefined,
): Promise<IKryptos> => {
  if (!key?.kryptos && !key?.predicate) {
    throw new ServerError("Cookie signing key is not configured", {
      code: "cookie_signing_key_not_configured",
      title: "Cookie Signing Key Not Configured",
      type: "urn:lindorm:pylon:error:cookie_signing_key_not_configured",
      details:
        'A cookie was set with `signed: true`, but no cookie signing key is configured; name the key that signs cookies in the pylon options (`keys.cookie.signature`, e.g. `{ predicate: { purpose: "cookie", publish: false } }`). A session cookie chains to it — `keys.session.signature ?? keys.cookie.signature` — so naming the cookie key is what makes any cookie signable. Pylon will not guess one: the vault\'s default set is the published keys, so a guess would sign cookies with the JWKS token key.',
      data: { floor: COOKIE_SIGN_FLOOR },
    });
  }

  // The floor is applied LAST so it always wins the merge: `key.predicate` is
  // duck-typed and could carry a floor key (e.g. `use`), which must never
  // override the policy. Per-layer `undefined` stripping keeps a
  // `{ x: undefined }` predicate from becoming match-all.
  const query = applyKeyFloor(COOKIE_SIGN_FLOOR, key.predicate);

  let kryptos: IKryptos;

  if (key.kryptos) {
    kryptos = key.kryptos;
  } else {
    try {
      kryptos = await amphora.find(query);
    } catch (error) {
      throw new ServerError("No cookie signing key matches the configured predicate", {
        code: "cookie_signing_key_not_found",
        title: "Cookie Signing Key Not Found",
        type: "urn:lindorm:pylon:error:cookie_signing_key_not_found",
        details:
          "The amphora holds no usable key matching the configured cookie signing key (`keys.cookie.signature`, or `keys.session.signature` for the session cookie); add the key to the vault (the kryptos rotation worker mints the keys it is given) or correct the predicate. Note that amphora queries the PUBLISHED set by default — an internal cookie key needs `publish: false`.",
        data: { query },
        debug: { error: (error as Error).message },
      });
    }
  }

  if (!Predicated.match(kryptos, COOKIE_SIGN_FLOOR)) {
    throw new ServerError("Cookie signing key violates the signing floor", {
      code: "cookie_signing_key_policy_violation",
      title: "Cookie Signing Key Policy Violation",
      type: "urn:lindorm:pylon:error:cookie_signing_key_policy_violation",
      details:
        'The key named as the cookie signing key (`keys.cookie.signature`, or `keys.session.signature` for the session cookie) cannot sign: a signing key must have use "sig" and a private half, and it must be active — a key that has expired, or whose notBefore has not yet passed, cannot sign a new cookie.',
      data: {
        kid: kryptos.id,
        use: kryptos.use,
        hasPrivateKey: kryptos.hasPrivateKey,
        isActive: kryptos.isActive,
        floor: COOKIE_SIGN_FLOOR,
      },
      debug: { kryptos: kryptos.toJSON() },
    });
  }

  return kryptos;
};
