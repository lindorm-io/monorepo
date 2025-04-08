import { KryptosAlgorithm, KryptosCurve, KryptosType } from "@lindorm/kryptos";
import { AesContentType } from "../content";

export type AesStringValues = {
  v: string; // version
  alg: KryptosAlgorithm; // encryption key algorithm
  cty: AesContentType; // content type
  crv: KryptosCurve | undefined; // epk curve
  hks: string | undefined; // hkdf salt
  iv: string; // initialisation vector
  kid: string; // key id
  kty: KryptosType | undefined; // epk key type
  p2c: string | undefined; // pbkdf iterations
  p2s: string | undefined; // pbkdf salt
  pei: string | undefined; // public encryption iv
  pek: string | undefined; // public encryption key
  pet: string | undefined; // public encryption tag
  tag: string; // auth tag
  x: string | undefined; // epk x
  y: string | undefined; // epk y
};
