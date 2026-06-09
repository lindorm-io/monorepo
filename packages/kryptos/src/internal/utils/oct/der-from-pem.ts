import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromString, OctBuffer } from "../../../types/index.js";

type Options = Omit<KryptosFromString, "id" | "algorithm" | "type" | "use">;

type Result = Omit<OctBuffer, "id" | "algorithm" | "type" | "use">;

export const createOctDerFromPem = (options: Options): Result => {
  if (!options.privateKey) {
    throw new KryptosError("Invalid key", {
      code: "missing_oct_private_key",
      title: "Missing Oct Private Key",
      details: "No oct private key PEM was provided to decode into DER bytes.",
    });
  }

  const chunks = options.privateKey
    .split("\n")
    .filter((chunk) => !chunk.startsWith("-----BEGIN OCT PRIVATE KEY-----"))
    .filter((chunk) => !chunk.startsWith("-----END OCT PRIVATE KEY-----"));

  return { privateKey: Buffer.from(chunks.join(""), "base64") };
};
