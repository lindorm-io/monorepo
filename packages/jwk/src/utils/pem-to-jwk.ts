import { JwkError } from "../errors";
import { JwkValues, PemValues } from "../types";
import { createEcJwk } from "./private/ec";
import { createRsaJwk } from "./private/rsa";

export const pemToJwk = (options: PemValues): JwkValues => {
  const { type } = options;

  switch (type) {
    case "EC":
      return createEcJwk(options);

    case "RSA":
      return createRsaJwk(options);

    default:
      throw new JwkError("Invalid KeyType");
  }
};
