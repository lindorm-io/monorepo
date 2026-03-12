import type { IAmphora } from "@lindorm/amphora";
import { AesKit, parseAes } from "@lindorm/aes";
import { ProteusError } from "../../../errors";

export const decryptFieldValue = (
  cipher: string,
  amphora: IAmphora,
  fieldKey = "unknown",
  entityName = "unknown",
): unknown => {
  if (!amphora) {
    throw new ProteusError(
      "Encryption requires an amphora instance but none was provided",
    );
  }

  try {
    const parsed = parseAes(cipher);
    const key = amphora.findSync({ id: parsed.keyId });
    const kit = new AesKit({ kryptos: key });
    return kit.decrypt(cipher);
  } catch (error) {
    throw new ProteusError(
      `Failed to decrypt field "${fieldKey}" on entity "${entityName}"`,
      {
        error: error as Error,
      },
    );
  }
};
