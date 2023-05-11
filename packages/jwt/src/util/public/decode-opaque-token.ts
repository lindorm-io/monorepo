import { Dict } from "@lindorm-io/common-types";
import { baseParse } from "@lindorm-io/core";
import { TokenHeaderType } from "../../enum";
import { OpaqueTokenHeader } from "./create-opaque-token";

export type DecodedOpaqueToken<T = Dict> = {
  id: string;
  header: OpaqueTokenHeader<T>;
  signature: string;
};

export const decodeOpaqueToken = <T = Dict>(token: string): DecodedOpaqueToken<T> => {
  try {
    const [head, signature] = token.split(".");
    const header = JSON.parse(baseParse(head));

    if (header.typ !== TokenHeaderType.OPAQUE) {
      throw new Error("Invalid token type");
    }

    return {
      id: header.oti,
      header,
      signature,
    };
  } catch {
    throw new Error("Invalid token");
  }
};
