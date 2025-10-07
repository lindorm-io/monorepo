import { KryptosEncryption } from "@lindorm/kryptos";

export const authTagLength = (encryption: KryptosEncryption): number => {
  switch (encryption) {
    case "A128CBC-HS256":
      return 32;

    case "A192CBC-HS384":
      return 48;

    case "A256CBC-HS512":
      return 64;

    case "A128GCM":
    case "A192GCM":
    case "A256GCM":
      return 16;

    default:
      throw new Error(`Unsupported encryption algorithm: ${encryption as any}`);
  }
};
