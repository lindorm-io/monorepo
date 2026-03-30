import { B64 } from "@lindorm/b64";
import { KryptosError } from "../../../errors";
import { KryptosExportMode, KryptosFromBuffer, OctJwk } from "../../../types";

type Options = Omit<KryptosFromBuffer, "id" | "algorithm" | "type" | "use"> & {
  mode: KryptosExportMode;
};

type Result = Omit<OctJwk, "kid" | "alg" | "kty" | "use">;

export const exportOctToJwk = (options: Options): Result => {
  if (!options.privateKey) {
    throw new KryptosError("Private key is required");
  }

  if (options.mode !== "private") {
    return { k: "" };
  }

  return { k: B64.encode(options.privateKey, "base64url") };
};
