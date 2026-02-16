import { Dict } from "@lindorm/types";
import { CoseTarget } from "../cose-target";
import { SignJwtContent, SignJwtOptions } from "../jwt";

export type SignCwtContent<C extends Dict = Dict> = SignJwtContent<C>;

export type SignCwtOptions = SignJwtOptions & {
  target?: CoseTarget;
};

export type SignedCwt = {
  buffer: Buffer;
  expiresAt: Date;
  expiresIn: number;
  expiresOn: number;
  objectId: string;
  token: string;
  tokenId: string;
};
