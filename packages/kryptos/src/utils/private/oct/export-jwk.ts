import { B64 } from "@lindorm/b64";
import { KryptosError } from "../../../errors";
import { KryptosDer, KryptosExportMode, OctJwk } from "../../../types";

type Options = Omit<KryptosDer, "algorithm" | "type" | "use"> & {
  mode: KryptosExportMode;
};

type Result = Omit<OctJwk, "alg" | "kty" | "use">;

export const _exportOctToJwk = (options: Options): Result => {
  if (!options.privateKey) {
    throw new KryptosError("Private key is required");
  }

  if (options.mode !== "private") {
    return { k: "" };
  }

  return { k: B64.encode(options.privateKey, "base64url") };
};
