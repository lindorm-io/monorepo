import type { WireTokenHeader } from "../header.js";

export type DecodedJws = {
  header: WireTokenHeader;
  payload: string;
  signature: string;
};
