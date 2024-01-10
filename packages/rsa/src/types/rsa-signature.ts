import { KeySet } from "@lindorm-io/jwk";
import { BufferFormat, KeyObject, SignatureAlgorithm } from "./types";

export type CreateRsaSignatureOptions = {
  algorithm?: SignatureAlgorithm;
  data: string;
  format?: BufferFormat;
  key?: KeyObject;
  keySet?: KeySet;
};

export type VerifyRsaSignatureOptions = {
  algorithm?: SignatureAlgorithm;
  data: string;
  format?: BufferFormat;
  key?: KeyObject;
  keySet?: KeySet;
  signature: string;
};
