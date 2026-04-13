import { encodeOid, encodeSequence, encodeSet, encodeUtf8String } from "../asn1";
import { X509_OID_COMMON_NAME, X509_OID_ORGANIZATION_NAME } from "./oids";

export type X509NameInput =
  | {
      commonName: string;
      organization?: string;
    }
  | {
      raw: Buffer;
    };

const rdn = (oid: string, value: string): Buffer =>
  encodeSet([encodeSequence([encodeOid(oid), encodeUtf8String(value)])]);

export const encodeX509Name = (name: X509NameInput): Buffer => {
  if ("raw" in name) {
    return Buffer.from(name.raw);
  }

  const rdns: Array<Buffer> = [];

  if (name.organization !== undefined) {
    rdns.push(rdn(X509_OID_ORGANIZATION_NAME, name.organization));
  }

  rdns.push(rdn(X509_OID_COMMON_NAME, name.commonName));

  return encodeSequence(rdns);
};
