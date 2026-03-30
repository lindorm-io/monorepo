import { IKryptos } from "@lindorm/kryptos";
import { encode } from "cbor";
import { SignatureKit } from "../../classes";

type CreateOptions = {
  kryptos: IKryptos;
  payload: Buffer;
  protectedHeader: Buffer;
};

type VerifyOptions = {
  kryptos: IKryptos;
  payload: Buffer;
  protectedHeader: Buffer;
  signature: Buffer;
};

const encodeSignature = (options: CreateOptions): Buffer =>
  encode(["Signature1", options.protectedHeader, Buffer.alloc(0), options.payload]);

export const createCoseSignature = (options: CreateOptions): Buffer => {
  const signature = encodeSignature(options);

  return new SignatureKit({ kryptos: options.kryptos, dsa: "ieee-p1363" }).sign(
    signature,
  );
};

export const verifyCoseSignature = (options: VerifyOptions): boolean => {
  const signature = encodeSignature(options);

  return new SignatureKit({ kryptos: options.kryptos, dsa: "ieee-p1363" }).verify(
    signature,
    options.signature,
  );
};
