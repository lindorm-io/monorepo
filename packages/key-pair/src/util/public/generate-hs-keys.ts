import { randomUnreserved } from "@lindorm-io/random";
import { Algorithm, KeyType } from "../../enum";

export type GenerateHsKeysOptions = {
  algorithm?: Algorithm;
  length?: number;
};

export type GenerateHsKeysData = {
  algorithms: Array<Algorithm>;
  privateKey: string;
  publicKey: string;
  type: KeyType;
};

export const generateHsKeys = (options: GenerateHsKeysOptions = {}): GenerateHsKeysData => {
  const { algorithm = Algorithm.HS256, length = 128 } = options;

  const algorithms = [algorithm];
  const privateKey = randomUnreserved(length);
  const publicKey = privateKey;

  return {
    algorithms,
    privateKey,
    publicKey,
    type: KeyType.HS,
  };
};
