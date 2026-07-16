import { applyKeyFloor, ENVELOPE_FLOOR, type IAmphora } from "@lindorm/amphora";
import { ServerError } from "@lindorm/errors";
import type { IKryptos } from "@lindorm/kryptos";
import { Predicated } from "@lindorm/utils";
import type { PylonEncKey } from "../../../types/index.js";

/**
 * Resolve the key that seals a cookie (or the session it stands for), keeping the
 * two jobs a predicate can do strictly apart (only one survives key injection):
 *
 *   FLOOR     — policy. Checked on the key, whatever its provenance.
 *   PREDICATE — a vault query. Checked on nothing; it only ever selects.
 *
 * A cookie is ENVELOPE encryption: pylon seals a value THIS server reopens on the
 * next request, so the floor is `ENVELOPE_FLOOR` — `use: "enc"`, active, and a
 * private/secret half — never the looser SEAL floor that would admit a public
 * recipient key we could never decrypt with.
 *
 * The selector is REQUIRED, and it is per-cookie: the caller hands over the key
 * the cookie itself names, or the deployment's `keys.cookie.encryption` (the
 * session cookie chains `keys.session.encryption ?? keys.cookie.encryption`).
 * Falling back to the floor alone would query the vault's default set — the
 * PUBLISHED keys — and seal cookies with the JWKS token key. This mirrors
 * proteus's `unnamed_encryption_key`: "which key encrypts this" must not have an
 * implicit answer, so a bare cookie is a loud failure, not a silent guess.
 */
export const resolveCookieEncryptionKey = async (
  amphora: IAmphora,
  key: PylonEncKey | undefined,
): Promise<IKryptos> => {
  if (!key?.kryptos && !key?.predicate) {
    throw new ServerError("Cookie encryption key is not configured", {
      code: "cookie_encryption_key_not_configured",
      title: "Cookie Encryption Key Not Configured",
      type: "urn:lindorm:pylon:error:cookie_encryption_key_not_configured",
      details:
        'A cookie was set with `encrypted: true`, but no cookie encryption key is configured; name the key that seals cookies in the pylon options (`keys.cookie.encryption`, e.g. `{ predicate: { purpose: "cookie", publish: false } }`). A session cookie chains to it — `keys.session.encryption ?? keys.cookie.encryption` — so naming the cookie key is what makes any cookie encryptable. Pylon will not guess one: the vault\'s default set is the published keys, so a guess would seal cookies with the JWKS token key.',
      data: { floor: ENVELOPE_FLOOR },
    });
  }

  // The floor is applied LAST so it always wins the merge: `key.predicate` is
  // duck-typed and could carry a floor key (e.g. `use`), which must never
  // override the policy. Per-layer `undefined` stripping keeps a
  // `{ x: undefined }` predicate from becoming match-all.
  const query = applyKeyFloor(ENVELOPE_FLOOR, key.predicate);

  let kryptos: IKryptos;

  if (key.kryptos) {
    kryptos = key.kryptos;
  } else {
    try {
      kryptos = await amphora.find(query);
    } catch (error) {
      throw new ServerError("No cookie encryption key matches the configured predicate", {
        code: "cookie_encryption_key_not_found",
        title: "Cookie Encryption Key Not Found",
        type: "urn:lindorm:pylon:error:cookie_encryption_key_not_found",
        details:
          "The amphora holds no usable key matching the configured cookie encryption key (`keys.cookie.encryption`, or `keys.session.encryption` for the session cookie); add the key to the vault (the kryptos rotation worker mints the keys it is given) or correct the predicate. Note that amphora queries the PUBLISHED set by default — an internal cookie key needs `publish: false`.",
        data: { query },
        debug: { error: (error as Error).message },
      });
    }
  }

  if (!Predicated.match(kryptos, ENVELOPE_FLOOR)) {
    throw new ServerError("Cookie encryption key violates the encryption floor", {
      code: "cookie_encryption_key_policy_violation",
      title: "Cookie Encryption Key Policy Violation",
      type: "urn:lindorm:pylon:error:cookie_encryption_key_policy_violation",
      details:
        'The key named as the cookie encryption key (`keys.cookie.encryption`, or `keys.session.encryption` for the session cookie) cannot seal a cookie: an encryption key must have use "enc" and a private/secret half — a cookie is reopened by this same server — and it must be active, so a key that has expired, or whose notBefore has not yet passed, cannot seal a new cookie.',
      data: {
        kid: kryptos.id,
        use: kryptos.use,
        hasPrivateKey: kryptos.hasPrivateKey,
        isActive: kryptos.isActive,
        floor: ENVELOPE_FLOOR,
      },
      debug: { kryptos: kryptos.toJSON() },
    });
  }

  return kryptos;
};
