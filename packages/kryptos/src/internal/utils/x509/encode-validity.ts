import { encodeSequence, encodeTime } from "../asn1";

export const encodeX509Validity = (notBefore: Date, notAfter: Date): Buffer =>
  encodeSequence([encodeTime(notBefore), encodeTime(notAfter)]);
