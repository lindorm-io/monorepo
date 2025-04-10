import { Dict } from "@lindorm/types";
import { encode } from "cbor";

type SignOptions = {
  protectedHeader: Buffer;
  unprotectedHeader: Dict;
  payload: Buffer;
  signature: Buffer;
};

export const createCoseSignToken = (options: SignOptions): Buffer =>
  encode([
    options.protectedHeader,
    options.unprotectedHeader,
    options.payload,
    options.signature,
  ]);
