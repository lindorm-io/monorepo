import { Dict } from "@lindorm-io/common-types";
import { baseHash } from "@lindorm-io/core";
import { RandomStringOptions, randomToken } from "@lindorm-io/random";
import { TokenHeaderType } from "../../enum";

export const createOpaqueToken = (
  length = 128,
  header: Dict = {},
  options: RandomStringOptions = {},
): string => {
  const head = baseHash(JSON.stringify({ ...header, typ: TokenHeaderType.OPAQUE })).replace(
    /=/g,
    "",
  );
  const payload = randomToken(length, options);

  return `${head}.${payload}`;
};
