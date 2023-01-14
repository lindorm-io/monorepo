import { TokenError } from "../../error";

export const assertClaimEquals = (
  expect: string | number | boolean,
  actual: string | number | boolean | null,
  key: string,
): void => {
  if (!actual) {
    throw new TokenError("Invalid token", {
      debug: {
        expect,
        actual,
      },
      description: `Claim [ ${key} ] not found on token`,
    });
  }

  if (expect === actual) return;

  throw new TokenError("Invalid token", {
    debug: {
      expect,
      actual,
    },
    description: `Claim [ ${key} ] is invalid`,
  });
};
