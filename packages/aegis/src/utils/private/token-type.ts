import { TokenHeaderType } from "../../types";
import { decodeTokenHeader } from "./token-header";

export const decodeTokenType = (token: string): TokenHeaderType => {
  const [head] = token.split(".");
  const header = decodeTokenHeader(head);
  return header.typ;
};
