import { KryptosAlgorithm, KryptosCurve, KryptosType } from "@lindorm/kryptos";

export type AesStringValues = {
  v: string; // version
  f: string; // format
  alg: KryptosAlgorithm; // encryption key algorithm
  crv: KryptosCurve | undefined; // epk curve
  hks: string | undefined; // hkdf salt
  iv: string; // initialisation vector
  kid: string; // key id
  kty: KryptosType | undefined; // epk key type
  p2c: string | undefined; // pbkdf iterations
  p2s: string | undefined; // pbkdf salt
  pek: string | undefined; // public encryption key
  tag: string; // auth tag
  x: string | undefined; // epk x
  y: string | undefined; // epk y
};
