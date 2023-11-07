import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { URN } from "../types";

const verifyAcr = (acr: string): boolean => {
  if (Object.values(AuthenticationFactor).includes(acr as AuthenticationFactor)) {
    return true;
  }
  if (Object.values(AuthenticationMethod).includes(acr as AuthenticationMethod)) {
    return true;
  }
  if (Object.values(AuthenticationStrategy).includes(acr as AuthenticationStrategy)) {
    return true;
  }
  if (Object.values(AuthenticationLevel).includes(acr as AuthenticationLevel)) {
    return true;
  }

  return false;
};

export const getVerifiedAcrValues = (acrValues: Array<string> = []): Array<URN> => {
  if (acrValues.every(verifyAcr)) return acrValues as Array<URN>;

  throw new ClientError("Invalid ACR values", {
    data: { acrValues },
  });
};
