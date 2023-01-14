import { TokenError } from "../../error";

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

  const difference = expect.filter((x) => !actual.includes(x));

  if (!difference.length) {
    return;
  }

  throw new TokenError("Invalid token", {
    debug: {
      expect,
      actual,
      difference,
    },
    description: `Claim [ ${key} ] is invalid`,
  });
};
