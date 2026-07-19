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
   * POLICY. Aegis's invariants for the operation (amphora's `key-floor`)
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

  // Read selection is kid-driven; NOTHING searches. A kid-less artifact with no
  // supplied key would otherwise fall through to `find(query)`, whose read-side
  // selector is the token's OWN declared `alg` — i.e. aegis would fetch the
  // newest vault key of the class the artifact chose for itself. That is an
  // undocumented fallback the design forbids: an artifact must not steer key
  // selection by class (RFC 8725 §3.1). So on the read side a missing kid is a
  // throw, not a query. (Both read ops keep an escape hatch: an injected
  // `kryptos` — resolved above — is honoured before this gate is reached.
  // Decrypt uses it for ciphertext written to a non-vault key; verify for a
  // signature made by one — the RFC 7523 `client_secret_jwt` assertion.) The
  // WRITE side (sign/encrypt) is legitimately selector-driven with no kid and
  // is unchanged.
  const isReadOp = operation === "verify" || operation === "decrypt";

  if (!options.kryptos && !id && isReadOp) {
    throw new AegisError("The artifact carries no key id and no key was supplied", {
      code: `${operation}_key_missing_kid`,
      data: { operation, profile },
      title: "Read Key Has No Kid",
      details:
        "This artifact carries no `kid` header and no key was supplied for the operation, so aegis will not search the vault by the algorithm the artifact declares — an artifact must not steer key selection by class (RFC 8725 §3.1). Supply the key the artifact names via its `kid`, or supply the key explicitly (verify / decrypt).",
    });
  }

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
