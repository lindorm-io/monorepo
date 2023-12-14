import { randomBytes } from "crypto";
import { KeyPairType } from "../../enums";

export type GenerateHsKeysOptions = {
  length?: number;
};

export type GenerateHsKeysData = {
  privateKey: string;
  type: KeyPairType;
};

export const generateHsKeys = (options: GenerateHsKeysOptions = {}): GenerateHsKeysData => {
  const length = options.length || 64;
  const privateKey = randomBytes(length).toString("hex").slice(0, length);

  return {
    privateKey,
    type: KeyPairType.HS,
  };
};
