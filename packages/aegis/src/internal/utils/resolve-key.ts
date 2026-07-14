import type { AmphoraPredicate, IAmphora } from "@lindorm/amphora";
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

  // The selector applies to the vault query alone. An injected key and a key
  // named by a token's kid both come from outside it.
  const query: AmphoraPredicate = { ...floor, ...selector };

  const kryptos =
    options.kryptos ??
    (id
      ? await amphora.findById(id)
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
