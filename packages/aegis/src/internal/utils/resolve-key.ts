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
   * It NARROWS, never widens: it restricts the candidate set to that issuer's
   * keys and there is NO fallback — an id the named issuer does not hold is a
   * miss, never a retry unscoped. That is why the value may come from the
   * artifact's own UNVERIFIED `iss`: set restriction can only produce a miss,
   * never a key the unscoped lookup would not also have considered. It relaxes
   * no floor; the floor is checked on whatever key comes back, exactly as before.
   *
   * ⚠ Falling back would be strictly WORSE than not scoping at all: an attacker
   * would no longer need an id COLLISION, only a `kid` the issuer it claims to
   * be does not hold.
   *
   * ⚠ A scope is used ONLY when it is a URI (a URL with an authority, or a URN).
   * That is not a heuristic — it is amphora's own invariant: an internal issuer
   * must be a URI at construction (`internal_issuer_not_uri`) and an external
   * one likewise (`external_issuer_not_uri`), so NO vault key can ever carry a
   * bare identifier as its issuer. A non-URI `iss` names a PARTY, not a
   * key-registration scope — an RFC 7523 client assertion's `iss` is the
   * `client_id`, and the `delegation` profile declares `issuer: "per-token"` for
   * exactly that reason. Scoping by one would not narrow the candidate set, it
   * would empty it: every such verify would fail, with no attacker denied
   * anything (a forgery has to name a REGISTERED issuer to be believed, and
   * those are URIs). A consumer whose client keys ARE vault residents files them
   * under a URI issuer (a URN is enough) and gets scoping; one that does not
   * supplies the key outright via the per-call `key.kryptos`, which bypasses the
   * vault and this scope entirely.
   *
   * Meaningless for a vault QUERY (`find`) — the write side selects by policy,
   * not by an artifact's claim — so it is applied to the `id` lookup alone.
   */
  issuer?: string;

  /** The profile in play, named in the error when the policy cannot be satisfied. */
  profile?: string;
};

/**
 * Resolve the key for one cryptographic operation, keeping the two jobs a
 * condition can do strictly apart (only one of them survives key injection):
 *
 *   FLOOR    — policy. Checked on the key, whatever its provenance.
 *   SELECTOR — a vault query. Checked on nothing; it only ever selects.
 *   SCOPE    — the issuer an `id` belongs to. Narrows the id lookup, nothing else.
 *
 * There is NO preference, NO ranking and NO fallback: a key either satisfies
 * the policy or it does not, and a miss is a throw. Falling back to a key the
 * policy forbids is how an unverifiable token gets minted — and falling back
 * from a scoped id lookup to an unscoped one is how an issuer answers for a
 * `kid` it does not hold.
 *
 * --- Why FOUR read paths resolve their key UNSCOPED (they are not oversights) ---
 *
 * An issuer scope has to come from somewhere, and these four artifacts have no
 * claims to read it off — by construction, not by omission:
 *
 *   - JWS  and its COSE twin CWS  — OPAQUE. The payload is arbitrary bytes with
 *     no claims layer at all; there is no `iss` in an unstructured artifact.
 *   - JWE  and its COSE twin CWE  — ENCRYPTED. The claims sit behind the very
 *     key this call is resolving, so nothing readable exists before it succeeds.
 *     A JWE/CWE that wraps a SIGNED inner token is covered where it counts: the
 *     inner JWT/CWT re-verifies through the scoped path.
 *
 * The claims-bearing artifacts — JWT and its COSE twins CWT/CWM — all carry a
 * cleartext, pre-verification `iss`, and all of them scope.
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
    throw new AegisKeyError("The artifact carries no key id and no key was supplied", {
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
