import { TokenError } from "../../error";
import { difference } from "lodash";

export const assertClaimDifference = (
  expect: Array<string>,
  actual: Array<string>,
  key: string,
): void => {
  if (!actual?.length) {
    throw new TokenError("Invalid token", {
      debug: {
        expect,
        actual,
      },
      description: `Claim [ ${key} ] not found on token`,
    });
  }

  const diff = difference(expect, actual);

  if (!diff.length) {
    return;
  }

  throw new TokenError("Invalid token", {
    debug: {
      expect,
      actual,
      diff,
    },
    description: `Claim [ ${key} ] is invalid`,
  });
};
