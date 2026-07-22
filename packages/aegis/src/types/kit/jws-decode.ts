import type { WireTokenHeader } from "../header/wire-header.js";

export type DecodedJws = {
  header: WireTokenHeader;
  payload: string;
  signature: string;
};
