import { KryptosError } from "../../../errors";
import { KryptosPem, RsaDer } from "../../../types";
import { _createRsaDerFromDer } from "./der-from-der";

type Options = Omit<KryptosPem, "algorithm" | "type" | "use">;

type Result = Omit<RsaDer, "algorithm" | "type" | "use">;

export const _createRsaDerFromB64 = (options: Options): Result => {
  const result: Result = {
    publicKey: Buffer.alloc(0),
  };

  if (options.privateKey && !options.publicKey) {
    const der = _createRsaDerFromDer({
      privateKey: Buffer.from(options.privateKey, "base64url"),
      publicKey: Buffer.alloc(0),
    });

    result.privateKey = der.privateKey;
    result.publicKey = der.publicKey;
  }

  if (!result.privateKey && options.privateKey) {
    result.privateKey = Buffer.from(options.privateKey, "base64url");
  }

  if (!result.publicKey.length && options.publicKey) {
    result.publicKey = Buffer.from(options.publicKey, "base64url");
  }

  if (!result.privateKey && !result.publicKey.length) {
    throw new KryptosError("Key creation failed");
  }

  return result;
};
