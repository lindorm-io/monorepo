import type { IAmphora } from "@lindorm/amphora";
import { AesKit, parseAes } from "@lindorm/aes";
import { ProteusError } from "../../../errors/index.js";

export const decryptFieldValue = (
  cipher: string,
  amphora: IAmphora,
  fieldKey = "unknown",
  entityName = "unknown",
): unknown => {
  if (!amphora) {
    throw new ProteusError(
      "Encryption requires an amphora instance but none was provided",
      { code: "missing_amphora" },
    );
  }

  try {
    const { keyId } = parseAes(cipher);
    const key = amphora.findByIdSync(keyId);
    const kit = new AesKit({ kryptos: key });
    return kit.decrypt(cipher);
  } catch (error) {
    throw new ProteusError(
      `Failed to decrypt field "${fieldKey}" on entity "${entityName}"`,
      {
        code: "decrypt_failed",
        data: { field: fieldKey, entity: entityName },
        error: error as Error,
      },
    );
  }
};
