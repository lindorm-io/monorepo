import { KeyPair } from "../../entity";
import { Algorithm, KeyType, NamedCurve } from "../../enum";
import { GenerateEcKeysOptions, generateEcKeys } from "./generate-ec-keys";
import { GenerateHsKeysOptions, generateHsKeys } from "./generate-hs-keys";
import { GenerateRsaKeysOptions, generateRsaKeys } from "./generate-rsa-keys";

type Options = GenerateEcKeysOptions &
  GenerateHsKeysOptions &
  GenerateRsaKeysOptions & {
    originUri?: string;
    type: KeyType;
  };

export const generateKeyPair = async (options: Options): Promise<KeyPair> => {
  const { originUri, type } = options;

  let algorithms: Array<Algorithm>;
  let namedCurve: NamedCurve | null = null;
  let passphrase: string | null = null;
  let privateKey: string;
  let publicKey: string | null = null;

  switch (type) {
    case KeyType.EC:
      ({ algorithms, namedCurve, privateKey, publicKey } = await generateEcKeys(options));
      break;

    case KeyType.HS:
      ({ algorithms, privateKey } = generateHsKeys(options));
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
    originUri,
    passphrase,
    privateKey,
    publicKey,
    type,
  });
};
