import { TokenError } from "../../error";
import { includes } from "lodash";

export const assertClaimIncludes = (
  expect: Array<string>,
  actual: string | null,
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

  if (includes(expect, actual)) {
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
