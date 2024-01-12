import { EcKeySet, RsaKeySet } from "../../../jwk/dist";
import { KeyPair } from "../entities";
import { KeyPairAlgorithm, KeyPairType, NamedCurve } from "../enums";
import { GenerateEcKeysOptions, GenerateHsKeysOptions, generateHsKeys } from "./private";

type Options = GenerateEcKeysOptions &
  GenerateHsKeysOptions & {
    originUri?: string;
    type: KeyPairType;
  };

const tmpGenerateEc = async (): Promise<any> => {
  const keySet = await EcKeySet.generate();
  const { curve, privateKey, publicKey } = keySet.export("pem");

  return {
    algorithms: [KeyPairAlgorithm.ES512],
    namedCurve: curve,
    privateKey,
    publicKey,
  };
};

const tmpGenerateRsa = async (): Promise<any> => {
  const keySet = await RsaKeySet.generate();
  const { privateKey, publicKey } = keySet.export("pem");

  return {
    algorithms: [KeyPairAlgorithm.RS512],
    privateKey,
    publicKey,
  };
};

export const generateKeyPair = async (options: Options): Promise<KeyPair> => {
  const { originUri, type } = options;

  let algorithms: Array<KeyPairAlgorithm>;
  let namedCurve: NamedCurve | null = null;
  let privateKey: string;
  let publicKey: string | null = null;

  switch (type) {
    case KeyPairType.EC:
      ({ algorithms, namedCurve, privateKey, publicKey } = await tmpGenerateEc());
      break;

    case KeyPairType.HS:
      algorithms = [KeyPairAlgorithm.HS256, KeyPairAlgorithm.HS384, KeyPairAlgorithm.HS512];
      ({ privateKey } = generateHsKeys(options));
      break;

    case KeyPairType.RSA:
      algorithms = [KeyPairAlgorithm.RS256, KeyPairAlgorithm.RS384, KeyPairAlgorithm.RS512];
      ({ privateKey, publicKey } = await tmpGenerateRsa());
      break;

    default:
      throw new Error("Invalid type");
  }

  return new KeyPair({
    algorithms,
    namedCurve,
    originUri,
    passphrase: "",
    privateKey,
    publicKey,
    type,
  });
};
