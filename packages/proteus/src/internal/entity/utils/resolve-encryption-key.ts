import { Matcher } from "@lindorm/match";
import { applyKeyFloor, ENVELOPE_FLOOR, type IAmphora } from "@lindorm/amphora";
import type { IKryptos } from "@lindorm/kryptos";
import { ProteusError } from "../../../errors/index.js";
import { ENCRYPTION_DEFAULT } from "../../constants/key-floor.js";
import type { MetaEncrypted } from "../types/metadata.js";

/**
 * Resolve the key that encrypts one `@Encrypted` field, keeping the two jobs a
 * condition can do strictly apart (only one of them survives key injection):
 *
 *   FLOOR     — policy. Checked on the key, whatever its provenance.
 *   CONDITION — a vault query. Checked on nothing; it only ever selects.
 *
 * An injected `kryptos` never came from the vault, so the condition cannot apply
 * to it — but the FLOOR does, or a signing key handed to `@Encrypted({ kryptos })`
 * would happily encrypt the database. There is no fallback: a key either
 * satisfies the policy or it does not, and a miss is a throw.
 */
export const resolveEncryptionKey = (
  encrypted: MetaEncrypted,
  amphora: IAmphora,
  fieldKey: string,
  entityName: string,
): IKryptos => {
  // The floor is applied LAST so it always wins the merge: the condition is
  // duck-typed and could carry a floor key (e.g. `use`), which must never
  // override the policy. `ENCRYPTION_DEFAULT` (`publish: false`) is only a
  // default, so the caller's condition still wins over it; per-layer `undefined`
  // stripping keeps a `{ x: undefined }` condition from erasing that default.
  const query = applyKeyFloor(ENVELOPE_FLOOR, ENCRYPTION_DEFAULT, encrypted.condition);

  let kryptos: IKryptos;

  if (encrypted.kryptos) {
    kryptos = encrypted.kryptos;
  } else {
    try {
      kryptos = amphora.findSync(query);
    } catch (error) {
      throw new ProteusError(
        `No encryption key matches field "${fieldKey}" on entity "${entityName}"`,
        {
          code: "encryption_key_not_found",
          title: "Encryption Key Not Found",
          details: `The amphora holds no usable encryption key matching the condition declared for field "${fieldKey}" on entity "${entityName}"; add the key to the vault or correct the condition.`,
          data: { entity: entityName, field: fieldKey, query },
          debug: { error: (error as Error).message },
        },
      );
    }
  }

  if (!Matcher.match(kryptos, ENVELOPE_FLOOR)) {
    throw new ProteusError(
      `Encryption key for field "${fieldKey}" on entity "${entityName}" violates the encryption floor`,
      {
        code: "encryption_key_policy_violation",
        title: "Encryption Key Policy Violation",
        details: `The key named for field "${fieldKey}" on entity "${entityName}" cannot encrypt at rest: an at-rest key must have use "enc" and a private half, so that what it encrypts can be decrypted again, and it must be active — a key that has expired, or whose notBefore has not yet passed, cannot encrypt a new value.`,
        data: {
          entity: entityName,
          field: fieldKey,
          kid: kryptos.id,
          use: kryptos.use,
          hasPrivateKey: kryptos.hasPrivateKey,
          isActive: kryptos.isActive,
          floor: ENVELOPE_FLOOR,
        },
        debug: { kryptos: kryptos.toJSON() },
      },
    );
  }

  return kryptos;
};
