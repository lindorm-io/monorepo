import { encodeOid, encodeSequence, encodeSet, encodeUtf8String } from "../asn1/index.js";
import {
  X509_OID_COMMON_NAME,
  X509_OID_ORGANIZATION_NAME,
  X509_OID_ORGANIZATIONAL_UNIT_NAME,
} from "./oids.js";

export type X509NameInput =
  | {
      commonName: string;
      organization?: string;
      organizationalUnit?: string;
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

  // Conventional DN attribute order: O, OU, CN.
  const rdns: Array<Buffer> = [];

  if (name.organization !== undefined) {
    rdns.push(rdn(X509_OID_ORGANIZATION_NAME, name.organization));
  }

  if (name.organizationalUnit !== undefined) {
    rdns.push(rdn(X509_OID_ORGANIZATIONAL_UNIT_NAME, name.organizationalUnit));
  }

  rdns.push(rdn(X509_OID_COMMON_NAME, name.commonName));

  return encodeSequence(rdns);
};
