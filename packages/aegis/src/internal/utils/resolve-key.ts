import { applyKeyFloor, type AmphoraPredicate, type IAmphora } from "@lindorm/amphora";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { Predicated } from "@lindorm/utils";
import { AegisError } from "../../errors/index.js";
import { describeKeyOperation, type KeyOperation } from "./describe-key-operation.js";

export type ResolveKeyOptions = {
  amphora: IAmphora;
  logger: ILogger;
  operation: KeyOperation;

  /**
   * POLICY. Aegis's invariants for the operation (`internal/constants/key-floor`)
   * plus the artifact's own opinion (`profile.algClass`), plus — on the read
   * side, where selection is driven by the token's `kid` — the deployment's
   * verification/decryption policy.
   *
   * Enforced on EVERY key that reaches the crypto layer, however it got there:
   * selected from the vault, named by a token, or injected outright. This is
   * what makes key injection safe rather than an escape hatch.
   */
  floor: AmphoraPredicate;

  /**
   * QUERY. "Which of MY vault keys" — the deployment default merged with the
   * per-call predicate (shallow; the caller's key wins).
   *
   * A key that never came from the vault cannot satisfy a vault query — a
   * client secret has no `purpose: "token"` — so the selector is deliberately
   * NOT applied to an injected `kryptos`, nor to a key resolved by `id`.
   */
  selector?: AmphoraPredicate;

  /** A key supplied outright by the caller. Bypasses the vault — never the floor. */
  kryptos?: IKryptos;

  /**
   * A token's `kid`. Resolved with `findById`, which is deliberately UNFILTERED:
   * a token signed by a since-expired key must still verify. (An expired key
   * must never SIGN, which is why the sign side pins via the selector instead —
   * that path runs through the active-only filter.)
   *
   * An injected `kryptos` takes the vault out of the picture — but it does NOT
   * override an `id`: on the read side the artifact names the one key that can
   * read it, so a supplied key that names another is a caller error (below).
   */
  id?: string;

  /** The profile in play, named in the error when the policy cannot be satisfied. */
  profile?: string;
};

/**
 * Resolve the key for one cryptographic operation, keeping the two jobs a
 * predicate can do strictly apart (only one of them survives key injection):
 *
 *   FLOOR    — policy. Checked on the key, whatever its provenance.
 *   SELECTOR — a vault query. Checked on nothing; it only ever selects.
 *
 * There is NO preference, NO ranking and NO fallback: a key either satisfies
 * the policy or it does not, and a miss is a throw. Falling back to a key the
 * policy forbids is how an unverifiable token gets minted.
 */
export const resolveKey = async (options: ResolveKeyOptions): Promise<IKryptos> => {
  const { amphora, floor, id, logger, operation, profile, selector } = options;

  const copy = describeKeyOperation(operation);

  // An injected key and an `id` are both "use THIS key", and when they disagree
  // there is no silent winner: an artifact names the one key that can read or
  // check it, so a supplied key naming another is a caller error. Ignoring the
  // supplied key would send the caller to a vault key that cannot possibly
  // work; preferring it would decrypt with the wrong key material.
  if (options.kryptos && id && options.kryptos.id !== id) {
    throw new AegisError("Supplied key is not the key the artifact names", {
      code: `${operation}_key_mismatch`,
      data: { kid: id, suppliedKid: options.kryptos.id, operation },
      debug: { kryptos: options.kryptos.toJSON() },
      title: "Key Mismatch",
      details:
        "A key was supplied for an operation whose key is named by the artifact itself, and the two do not match. The artifact can only be read with the key it was written to; supply the key it names, or supply none and let it resolve from the vault.",
    });
  }

  // The selector applies to the vault query alone. An injected key and a key
  // named by a token's kid both come from outside it. The floor is applied LAST
  // so it always wins the merge — a selector duck-typed from config/JSON can
  // carry a floor key (e.g. `use`), and it must never override the policy.
  const query = applyKeyFloor(floor, selector);

  // BOTH lookups surface as an AegisError. The `findById` branch used to let
  // amphora's own `kryptos_not_found_by_id` escape, so a consumer catching
  // AegisError — which is the whole contract of this package — silently missed
  // every unresolvable `kid` on every read path (jwt.verify, jwe.decrypt, COSE,
  // AES). The `data` differs because the two misses are different failures: a
  // query miss is a POLICY failure (nothing satisfies it), an id miss is a
  // MISSING KEY (the artifact names one we do not hold).
  const kryptos =
    options.kryptos ??
    (id
      ? await amphora.findById(id).catch((error: Error) => {
          throw new AegisError(copy.notFound.message, {
            code: `${operation}_key_not_found`,
            data: { kid: id, profile },
            debug: { error: error.message },
            title: copy.notFound.title,
            details: copy.notFound.details,
          });
        })
      : await amphora.find(query).catch((error: Error) => {
          throw new AegisError(copy.notFound.message, {
            code: `${operation}_key_not_found`,
            data: { policy: query, profile },
            debug: { error: error.message },
            title: copy.notFound.title,
            details: copy.notFound.details,
          });
        }));

  // The FLOOR applies to the selected key, the pinned key AND the injected key.
  if (!Predicated.match(kryptos, floor)) {
    throw new AegisError(copy.violation.message, {
      code: `${operation}_key_policy_violation`,
      data: {
        kid: kryptos.id,
        algorithm: kryptos.algorithm,
        algClass: kryptos.algClass,
        floor,
        profile,
      },
      debug: { kryptos: kryptos.toJSON() },
      title: copy.violation.title,
      details: copy.violation.details,
    });
  }

  logger.debug("Kryptos resolved", { operation, kryptos: kryptos.toJSON() });

  return kryptos;
};
