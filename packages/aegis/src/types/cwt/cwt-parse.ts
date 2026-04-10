import { Dict } from "@lindorm/types";
import { ParsedTokenHeader } from "../header";
import { ParsedJwtPayload, TokenIdentity } from "../jwt";
import { DecodedCwt } from "./cwt-decode";

export type ParsedCwtHeader = Omit<ParsedTokenHeader, "headerType"> & {
  headerType: string;
};

export type ParsedCwtPayload<C extends Dict = Dict> = ParsedJwtPayload<C>;

export type ParsedCwt<C extends Dict = Dict> = {
  decoded: DecodedCwt<C>;
  header: ParsedCwtHeader;
  identity: TokenIdentity;
  payload: ParsedJwtPayload<C>;
  token: string;
};
