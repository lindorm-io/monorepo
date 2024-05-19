import { KryptosCurve, KryptosType } from "@lindorm/kryptos";
import { ShaAlgorithm } from "@lindorm/types";
import { AesEncryptionKeyAlgorithm } from "../types";

export type AesStringValues = {
  v: string; // version
  f: string; // format
  crv: KryptosCurve | undefined; // epk curve
  eka: AesEncryptionKeyAlgorithm | undefined; // encryption key algorithm
  hks: string | undefined; // hkdf salt
  ih: ShaAlgorithm | undefined; // auth tag integrity hash
  iv: string; // initialisation vector
  kid: string | undefined; // key id
  kty: KryptosType | undefined; // key type
  p2c: string | undefined; // pbkdf iterations
  p2s: string | undefined; // pbkdf salt
  pek: string | undefined; // public encryption key
  tag: string | undefined; // auth tag
  x: string | undefined; // epk x
  y: string | undefined; // epk y
};
