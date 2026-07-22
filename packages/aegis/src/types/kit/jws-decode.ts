import type { WireTokenHeader } from "../header/header.js";

export type DecodedJws = {
  header: WireTokenHeader;
  payload: string;
  signature: string;
};
