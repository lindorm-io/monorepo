import { Dict } from "@lindorm-io/common-types";
import { baseParse } from "@lindorm-io/core";
import { TokenHeaderType } from "../../enum";

export type ParsedTokenHeader<T extends Dict = Dict> = {
  typ: TokenHeaderType;
} & T;

export const parseTokenHeader = <T extends Dict = Dict>(token: string): ParsedTokenHeader<T> => {
  try {
    const [header] = token.split(".");
    return JSON.parse(baseParse(header));
  } catch {
    throw new Error("Invalid token header");
  }
};
