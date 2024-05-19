import { TokenHeaderType } from "../../types";
import { _decodeTokenHeader } from "./token-header";

export const _decodeTokenType = (token: string): TokenHeaderType => {
  const [head] = token.split(".");
  const header = _decodeTokenHeader(head);
  return header.typ;
};
