import { Dict } from "@lindorm/types";
import { ParsedTokenHeader } from "../header";
import { ParsedJwtPayload } from "../jwt";
import { DecodedCwt } from "./cwt-decode";

export type ParsedCwtHeader = Omit<ParsedTokenHeader, "headerType"> & {
  headerType: "application/cwt";
};

export type ParsedCwtPayload<C extends Dict = Dict> = ParsedJwtPayload<C>;

export type ParsedCwt<C extends Dict = Dict> = {
  decoded: DecodedCwt<C>;
  header: ParsedCwtHeader;
  payload: ParsedJwtPayload<C>;
  token: string;
};
