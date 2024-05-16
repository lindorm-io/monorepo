import { KryptosCurve, KryptosType } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { AesEncryptionKeyAlgorithm } from "./types";

export type AesStringValues = {
  v: string; // version
  f: string; // format
  cek: string | undefined; // public encryption key
  crv: KryptosCurve | undefined; // epk curve
  eka: AesEncryptionKeyAlgorithm | undefined; // encryption key algorithm
  ih: ShaAlgorithm | undefined; // auth tag integrity hash
  it: string | undefined; // kdf iterations
  iv: string; // initialisation vector
  kid: string | undefined; // key id
  kty: KryptosType | undefined; // key type
  s: string | undefined; // kdf salt
  tag: string | undefined; // auth tag
  x: string | undefined; // epk x
  y: string | undefined; // epk y
};
