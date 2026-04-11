import { Dict } from "@lindorm/types";
import { CoseTarget } from "../cose-target";
import { SignJwtContent, SignJwtOptions, SignedJwt } from "../jwt";

export type SignCwtContent<C extends Dict = Dict> = SignJwtContent<C>;

export type SignCwtOptions = SignJwtOptions & {
  target?: CoseTarget;
};

export type SignedCwt = SignedJwt & {
  buffer: Buffer;
};
