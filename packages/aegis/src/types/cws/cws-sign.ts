import { CoseTarget } from "../cose-target";
import { SignJwsOptions, SignedJws } from "../jws";

export type SignCwsOptions = SignJwsOptions & {
  target?: CoseTarget;
};

export type SignedCws = SignedJws & {
  buffer: Buffer;
};
