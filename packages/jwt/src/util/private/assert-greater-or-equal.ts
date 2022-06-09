import { TokenError } from "../../error";

export const assertGreaterOrEqual = (expect: number, actual: number, key: string): void => {
  if (actual >= expect) {
    return;
  }

  throw new TokenError("Invalid token", {
    debug: {
      expect,
      actual,
    },
    description: `Claim [ ${key} ] is invalid`,
  });
};
