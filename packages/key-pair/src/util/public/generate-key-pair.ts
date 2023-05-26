import { KeyPair } from "../../entity";
import { Algorithm, KeyType, NamedCurve } from "../../enum";
import { GenerateEcKeysOptions, generateEcKeys } from "./generate-ec-keys";
import { GenerateHsKeysOptions, generateHsKeys } from "./generate-hs-keys";
import { GenerateRsaKeysOptions, generateRsaKeys } from "./generate-rsa-keys";

type Options = GenerateEcKeysOptions &
  GenerateHsKeysOptions &
  GenerateRsaKeysOptions & {
    origin?: string;
    type: KeyType;
  };

export const generateKeyPair = async (options: Options): Promise<KeyPair> => {
  const { origin, type } = options;

  let algorithms: Array<Algorithm>;
  let namedCurve: NamedCurve | null = null;
  let passphrase: string | null = null;
  let privateKey: string;
  let publicKey: string;

  switch (type) {
    case KeyType.EC:
      ({ algorithms, namedCurve, privateKey, publicKey } = await generateEcKeys(options));
      break;

    case KeyType.HS:
      ({ algorithms, privateKey, publicKey } = generateHsKeys(options));
      break;

    case KeyType.RSA:
      ({ algorithms, passphrase, privateKey, publicKey } = await generateRsaKeys(options));
      break;

    default:
      throw new Error("Invalid type");
  }

  return new KeyPair({
    algorithms,
    namedCurve,
    origin,
    passphrase,
    privateKey,
    publicKey,
    type,
  });
};
