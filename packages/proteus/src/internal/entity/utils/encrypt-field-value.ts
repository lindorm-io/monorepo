import type { Dict } from "@lindorm/types";
import type { IAmphora } from "@lindorm/amphora";
import { AesKit } from "@lindorm/aes";
import { ProteusError } from "../../../errors";

export const encryptFieldValue = (
  value: unknown,
  predicate: Dict | null,
  amphora: IAmphora,
  fieldKey = "unknown",
  entityName = "unknown",
): string => {
  if (!amphora) {
    throw new ProteusError(
      "Encryption requires an amphora instance but none was provided",
    );
  }

  try {
    const key = amphora.findSync({ ...predicate, use: "enc" });
    const kit = new AesKit({ kryptos: key });
    return kit.encrypt(value as any, "encoded");
  } catch (error) {
    throw new ProteusError(
      `Failed to encrypt field "${fieldKey}" on entity "${entityName}"`,
      {
        error: error as Error,
      },
    );
  }
};
