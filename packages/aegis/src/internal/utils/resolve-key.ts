import { Matcher } from "@lindorm/match";
import { applyKeyFloor, type AmphoraCondition, type IAmphora } from "@lindorm/amphora";
import { isUri } from "@lindorm/is";
import type { IKryptos } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { AegisKeyError } from "../../errors/index.js";
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
  floor: AmphoraCondition;

  /**
   * QUERY. "Which of MY vault keys" — the deployment default merged with the
   * per-call condition (shallow; the caller's key wins).
   *
   * A key that never came from the vault cannot satisfy a vault query — a
   * client secret has no `purpose: "token"` — so the selector is deliberately
   * NOT applied to an injected `kryptos`, nor to a key resolved by `id`.
   */
  selector?: AmphoraCondition;

  /** A key supplied outright by the caller. Bypasses the vault — never the floor. */
  kryptos?: IKryptos;

  /**
   * A token's `kid`. Resolved with `findById`, which is deliberately UNFILTERED:
   * a token signed by a since-expired key must still verify. (An expired key
   * must never SIGN, which is why the sign side pins via the selector instead —
   * that path runs through the active-only filter.) The {@link issuer} scope
   * below narrows WHICH key that id may name; it does not reintroduce a time or
   * publish filter, so the expired-key rationale is untouched.
   *
   * An injected `kryptos` takes the vault out of the picture — but it does NOT
   * override an `id`: on the read side the artifact names the one key that can
   * read it, so a supplied key that names another is a caller error (below).
   */
  id?: string;

  /**
   * SCOPE. The issuer the {@link id} belongs to — a `kid` is unique only PER
   * ISSUER, so without one an id from any registered issuer can answer.
   *
   * It NARROWS, never widens, and there is NO unscoped retry. That is what lets
   * the value come from the artifact's own UNVERIFIED `iss`: restriction can only
   * produce a miss, and the floor is still checked on whatever key comes back.
   * ⚠ Falling back would be strictly WORSE than not scoping at all — an attacker
   * would no longer need an id COLLISION, only a `kid` the issuer it claims to be
   * does not hold.
   *
   * ⚠ A scope is used ONLY when it is a URI. Amphora refuses any other issuer at
   * construction (`internal_issuer_not_uri`, `external_issuer_not_uri`), so no
   * vault key can carry a bare identifier as its issuer and scoping by one would
   * EMPTY the candidate set rather than narrow it. A consumer whose client keys
   * are not vault residents supplies them via the per-call `key.kryptos`, which
   * bypasses the vault and this scope entirely.
   *
   * Applied to the `id` lookup alone: a vault QUERY selects by policy, never by
   * an artifact's claim.
   */
  issuer?: string;

  /** The profile in play, named in the error when the policy cannot be satisfied. */
  profile?: string;
};

/**
 * Resolve the key for one cryptographic operation, keeping the three jobs a
 * condition can do strictly apart (only the floor survives key injection):
 *
 *   FLOOR    — policy. Checked on the key, whatever its provenance.
 *   SELECTOR — a vault query. Checked on nothing; it only ever selects.
 *   SCOPE    — the issuer an `id` belongs to. Narrows the id lookup, nothing else.
 *
 * ⚠ NO preference, NO ranking, NO fallback: a miss is a throw. Falling back to a
 * key the policy forbids is how an unverifiable token gets minted, and falling
 * back from a scoped id lookup to an unscoped one is how an issuer answers for a
 * `kid` it does not hold.
 *
 * JWS/CWS (opaque payload) and JWE/CWE (the claims sit behind the very key being
 * resolved) have no `iss` to scope by, so those four read paths resolve UNSCOPED
 * by construction. A signed inner token inside a JWE/CWE re-verifies through the
 * scoped path. JWT and its COSE twins CWT/CWM all scope.
 */
export const resolveKey = async (options: ResolveKeyOptions): Promise<IKryptos> => {
  const { amphora, floor, id, logger, operation, profile, selector } = options;

  // The ONE place a scope is vetted, so no call site has to remember: only a URI
  // can be a vault key's issuer (see `ResolveKeyOptions.issuer`), so a bare
  // identifier is a party name, not a scope, and is dropped rather than turned
  // into a guaranteed miss.
  const issuer = isUri(options.issuer) ? options.issuer : undefined;

  const copy = describeKeyOperation(operation);

  // An injected key and an `id` are both "use THIS key", and when they disagree
  // there is no silent winner: an artifact names the one key that can read or
  // check it, so a supplied key naming another is a caller error. Ignoring the
  // supplied key would send the caller to a vault key that cannot possibly
  // work; preferring it would decrypt with the wrong key material.
  if (options.kryptos && id && options.kryptos.id !== id) {
    throw new AegisKeyError("Supplied key is not the key the artifact names", {
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

  // ⚠ Read selection is kid-driven; NOTHING searches. A kid-less artifact with no
  // supplied key would otherwise fall through to `find(query)`, whose read-side
  // selector is the token's OWN declared `alg` — aegis would fetch the newest
  // vault key of the class the artifact chose for itself, letting an artifact
  // steer key selection by class (RFC 8725 §3.1). So a missing kid is a throw on
  // the read side. The escape hatch is an injected `kryptos`, honoured above this
  // gate. The WRITE side (sign/encrypt) is legitimately selector-driven.
  const isReadOp = operation === "verify" || operation === "decrypt";

  if (!options.kryptos && !id && isReadOp) {
    throw new AegisKeyError("The artifact carries no key id and no key was supplied", {
      code: `${operation}_key_missing_kid`,
      data: { operation, profile },
      title: "Read Key Has No Kid",
      details:
        "This artifact carries no `kid` header and no key was supplied for the operation, so aegis will not search the vault by the algorithm the artifact declares — an artifact must not steer key selection by class. Supply the key the artifact names via its `kid`, or supply the key explicitly (verify / decrypt). RFC 8725 §3.1.",
    });
  }

  // ⚠ BOTH lookups surface as an AegisError: let amphora's own
  // `kryptos_not_found_by_id` escape and a consumer catching AegisError — the
  // whole contract of this package — silently misses every unresolvable `kid`.
  // The `data` differs because the misses differ: a query miss is a POLICY
  // failure, an id miss is a MISSING KEY.
  const kryptos =
    options.kryptos ??
    (id
      ? await amphora.findById(id, issuer).catch((error: Error) => {
          throw new AegisKeyError(copy.notFound.message, {
            code: `${operation}_key_not_found`,
            data: { kid: id, issuer, profile },
            debug: { error: error.message },
            title: copy.notFound.title,
            details: copy.notFound.details,
          });
        })
      : await amphora.find(query).catch((error: Error) => {
          throw new AegisKeyError(copy.notFound.message, {
            code: `${operation}_key_not_found`,
            data: { policy: query, profile },
            debug: { error: error.message },
            title: copy.notFound.title,
            details: copy.notFound.details,
          });
        }));

  // The FLOOR applies to the selected key, the pinned key AND the injected key.
  if (!Matcher.match(kryptos, floor)) {
    throw new AegisKeyError(copy.violation.message, {
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
