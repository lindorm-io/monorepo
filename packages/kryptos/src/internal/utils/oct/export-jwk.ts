import { B64 } from "@lindorm/b64";
import { KryptosError } from "../../../errors/index.js";
import type {
  KryptosExportMode,
  KryptosFromBuffer,
  OctJwk,
} from "../../../types/index.js";

type Options = Omit<KryptosFromBuffer, "id" | "algorithm" | "type" | "use"> & {
  mode: KryptosExportMode;
};

type Result = Omit<OctJwk, "kid" | "alg" | "kty" | "use">;

export const exportOctToJwk = (options: Options): Result => {
  if (!options.privateKey) {
    throw new KryptosError("Private key is required", {
      code: "missing_oct_private_key",
      title: "Missing Oct Private Key",
      details: "No oct private key was provided to export as a JWK.",
    });
  }

  if (options.mode !== "private") {
    return { k: "" };
  }

  return { k: B64.encode(options.privateKey, "base64url") };
};
