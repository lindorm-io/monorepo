import { Matcher } from "@lindorm/match";
import {
  applyKeyFloor,
  ENVELOPE_FLOOR,
  UNPUBLISHED_DEFAULT,
  type IAmphora,
} from "@lindorm/amphora";
import { ServerError } from "@lindorm/errors";
import type { IKryptos } from "@lindorm/kryptos";
import type { PylonEncKey } from "../../../types/index.js";

/**
 * Resolve the key that seals a cookie (or the session it stands for), keeping the
 * two jobs a condition can do strictly apart (only one survives key injection):
 *
 *   FLOOR     — policy. Checked on the key, whatever its provenance.
 *   CONDITION — a vault query. Checked on nothing; it only ever selects.
 *
 * A cookie is ENVELOPE encryption: pylon seals a value THIS server reopens on the
 * next request, so the floor is `ENVELOPE_FLOOR` — `use: "enc"`, active, and a
 * private/secret half — never the looser SEAL floor that would admit a public
 * recipient key we could never decrypt with.
 *
 * `UNPUBLISHED_DEFAULT` (`publish: false`) sits under the caller's condition as a
 * DEFAULT, so that condition still wins over it. A cookie key is by definition
 * unpublished — it never leaves this server and never belongs in a JWKS — and
 * amphora's own gate hides exactly that key from a query naming no `publish`.
 * Without the default layer a selector had to spell `publish: false` itself to
 * reach its own cookie key, which is a workaround, not a policy.
 *
 * The selector is still REQUIRED, and it is still per-cookie: the caller hands
 * over the key the cookie itself names, or the deployment's `cookies.encryption`
 * (the session cookie chains `auth.session.encryption ?? cookies.encryption`).
 * The default narrows the guess; it does not supply one. Falling back to floor
 * plus default would seal a cookie with whichever internal enc key is newest —
 * the session key, a column KEK — collapsing the blast radius the separate
 * roles exist to keep apart. This mirrors proteus's `unnamed_encryption_key`:
 * "which key encrypts this" must not have an implicit answer, so a bare cookie
 * is a loud failure, not a silent guess.
 */
export const resolveCookieEncryptionKey = async (
  amphora: IAmphora,
  key: PylonEncKey | undefined,
): Promise<IKryptos> => {
  if (!key?.kryptos && !key?.condition) {
    throw new ServerError("Cookie encryption key is not configured", {
      code: "cookie_encryption_key_not_configured",
      title: "Cookie Encryption Key Not Configured",
      type: "urn:lindorm:pylon:error:cookie_encryption_key_not_configured",
      details:
        'A cookie was set with `encrypted: true`, but no cookie encryption key is configured; name the key that seals cookies in the pylon options (`cookies.encryption`, e.g. `{ condition: { purpose: "cookie" } }`). A session cookie chains to it — `auth.session.encryption ?? cookies.encryption` — so naming the cookie key is what makes any cookie encryptable. Pylon will not guess one: a guess would seal cookies with whichever internal encryption key is newest — the session key, a KEK — collapsing the blast radius the separate roles exist to keep apart.',
      data: { floor: ENVELOPE_FLOOR },
    });
  }

  // The floor is applied LAST so it always wins the merge: `key.condition` is
  // duck-typed and could carry a floor key (e.g. `use`), which must never
  // override the policy. `UNPUBLISHED_DEFAULT` (`publish: false`) is only a
  // default, so the caller's condition still wins over it; per-layer `undefined`
  // stripping keeps a `{ x: undefined }` condition from erasing that default.
  const query = applyKeyFloor(ENVELOPE_FLOOR, UNPUBLISHED_DEFAULT, key.condition);

  let kryptos: IKryptos;

  if (key.kryptos) {
    kryptos = key.kryptos;
  } else {
    try {
      kryptos = await amphora.find(query);
    } catch (error) {
      throw new ServerError("No cookie encryption key matches the configured condition", {
        code: "cookie_encryption_key_not_found",
        title: "Cookie Encryption Key Not Found",
        type: "urn:lindorm:pylon:error:cookie_encryption_key_not_found",
        details:
          "The amphora holds no usable key matching the configured cookie encryption key (`cookies.encryption`, or `auth.session.encryption` for the session cookie); add the key to the vault (the kryptos rotation worker mints the keys it is given) or correct the condition. The query defaults to `publish: false` — a cookie key is unpublished by definition — so a deployment that deliberately seals cookies with a published key must say `publish: true`.",
        data: { query },
        debug: { error: (error as Error).message },
      });
    }
  }

  if (!Matcher.match(kryptos, ENVELOPE_FLOOR)) {
    throw new ServerError("Cookie encryption key violates the encryption floor", {
      code: "cookie_encryption_key_policy_violation",
      title: "Cookie Encryption Key Policy Violation",
      type: "urn:lindorm:pylon:error:cookie_encryption_key_policy_violation",
      details:
        'The key named as the cookie encryption key (`cookies.encryption`, or `auth.session.encryption` for the session cookie) cannot seal a cookie: an encryption key must have use "enc" and a private/secret half — a cookie is reopened by this same server — and it must be active, so a key that has expired, or whose notBefore has not yet passed, cannot seal a new cookie.',
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
