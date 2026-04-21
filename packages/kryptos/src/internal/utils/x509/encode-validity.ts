import { encodeSequence, encodeTime } from "../asn1/index.js";

export const encodeX509Validity = (notBefore: Date, notAfter: Date): Buffer =>
  encodeSequence([encodeTime(notBefore), encodeTime(notAfter)]);
