import { GenerateRsaKeysOptions, generateRsaKeys } from "@lindorm-io/rsa";
import { KeyPair } from "../entities";
import { KeyPairAlgorithm, KeyPairType, NamedCurve } from "../enums";
import {
  GenerateEcKeysOptions,
  GenerateHsKeysOptions,
  generateEcKeys,
  generateHsKeys,
} from "./private";

type Options = GenerateEcKeysOptions &
  GenerateHsKeysOptions &
  GenerateRsaKeysOptions & {
    originUri?: string;
    type: KeyPairType;
  };

export const generateKeyPair = async (options: Options): Promise<KeyPair> => {
  const { originUri, type } = options;

  let algorithms: Array<KeyPairAlgorithm>;
  let namedCurve: NamedCurve | null = null;
  let passphrase: string | null = options.passphrase ?? null;
  let privateKey: string;
  let publicKey: string | null = null;

  switch (type) {
    case KeyPairType.EC:
      ({ algorithms, namedCurve, privateKey, publicKey } = await generateEcKeys(options));
      break;

    case KeyPairType.HS:
      algorithms = [KeyPairAlgorithm.HS256, KeyPairAlgorithm.HS384, KeyPairAlgorithm.HS512];
      ({ privateKey } = generateHsKeys(options));
      break;

    case KeyPairType.RSA:
      algorithms = [KeyPairAlgorithm.RS256, KeyPairAlgorithm.RS384, KeyPairAlgorithm.RS512];
      ({ privateKey, publicKey } = await generateRsaKeys(options));
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
