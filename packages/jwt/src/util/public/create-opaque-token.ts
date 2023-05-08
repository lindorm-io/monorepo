import { Dict } from "@lindorm-io/common-types";
import { baseHash } from "@lindorm-io/core";
import { randomToken } from "@lindorm-io/random";
import { TokenHeaderType } from "../../enum";

export const createOpaqueToken = (length = 192, header: Dict = {}): string => {
  const head = baseHash(JSON.stringify({ ...header, typ: TokenHeaderType.OPAQUE })).replace(
    /=/g,
    "",
  );
  const payload = randomToken(length);

  return `${head}.${payload}`;
};
