import { KryptosError } from "../../../errors";
import { KryptosFromString, OctBuffer } from "../../../types";

type Options = Omit<KryptosFromString, "id" | "algorithm" | "type" | "use">;

type Result = Omit<OctBuffer, "id" | "algorithm" | "type" | "use">;

export const createOctDerFromPem = (options: Options): Result => {
  if (!options.privateKey) {
    throw new KryptosError("Invalid key");
  }

  const chunks = options.privateKey
    .split("\n")
    .filter((chunk) => !chunk.startsWith("-----BEGIN OCT PRIVATE KEY-----"))
    .filter((chunk) => !chunk.startsWith("-----END OCT PRIVATE KEY-----"));

  return { privateKey: Buffer.from(chunks.join(""), "base64") };
};
