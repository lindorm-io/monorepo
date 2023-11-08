import { KeyType, NamedCurve } from "../enum";

export interface DefaultJWK {
  alg: string;
  crv?: string;
  keyOps: Array<string>;
  kid: string;
  kty: string;
  use: string;
}

export interface LindormJWK extends DefaultJWK {
  createdAt?: number;
  expiresAt?: number;
  notBefore?: number;
  originUri?: string;
  ownerId?: string;
}

export interface EllipticalJWK {
  d?: string;
  x: string;
  y: string;
  crv: string;
}

export interface RivestJWK {
  d?: string;
  dp?: string;
  dq?: string;
  e: string;
  n: string;
  p?: string;
  q?: string;
  qi?: string;
}

export type KeyJWK = EllipticalJWK | RivestJWK;
export type JWK = LindormJWK & KeyJWK;

export interface JoseData {
  privateKey?: string;
  publicKey: string;
}

export interface JoseDataEC extends JoseData {
  crv: string;
}

export interface EncodeKeysOptions {
  exposePrivateKey: boolean;
  namedCurve?: NamedCurve | null;
  privateKey?: string | null;
  publicKey: string;
  type: KeyType;
}
