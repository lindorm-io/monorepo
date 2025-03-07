import { KryptosError } from "../../../errors";
import { KryptosBuffer, KryptosFromString } from "../../../types";
import { getOctSize } from "../oct";

const allocate = (options: KryptosFromString): Buffer => {
  const size = getOctSize(options);

  if (!options.privateKey) {
    throw new KryptosError("Missing private key");
  }

  const buffer = Buffer.alloc(size);
  buffer.write(options.privateKey);

  return buffer;
};

export const createDerFromUtf = (options: KryptosFromString): KryptosBuffer => {
  switch (options.type) {
    case "oct":
      return {
        algorithm: options.algorithm,
        privateKey: allocate(options),
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
