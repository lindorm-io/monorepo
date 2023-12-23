import { EcJwkValues, EllipticCurve, getCurveLength } from "@lindorm-io/jwk";
import { AesError } from "../../../errors";
import { AesPublicJwk } from "../../../types";

export const getPublicKeyBuffer = (key: AesPublicJwk): Buffer =>
  Buffer.concat([Buffer.from([0x04]), Buffer.from(key.x, "base64"), Buffer.from(key.y, "base64")]);

export const getPrivateKeyBuffer = (key: EcJwkValues): Buffer => {
  if (!key.d) {
    throw new AesError("Missing private key", { debug: { key } });
  }

  return Buffer.from(key.d, "base64");
};

export const getJwkFromBuffer = (curve: EllipticCurve, buffer: Buffer): AesPublicJwk => {
  const { len } = getCurveLength(curve);

  return {
    crv: curve,
    x: buffer.subarray(-len, -len / 2).toString("base64"),
    y: buffer.subarray(-len / 2).toString("base64"),
  };
};
