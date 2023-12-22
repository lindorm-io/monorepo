import { OctJwkValues, OctPemValues } from "../../types";

export const createOctJwk = ({ id, symmetricKey, type }: OctPemValues): OctJwkValues => ({
  kty: type,
  k: Buffer.from(symmetricKey, "utf-8").toString("base64"),
  kid: id,
});

export const createOctPem = ({ k, kid, kty }: OctJwkValues): OctPemValues => ({
  id: kid,
  symmetricKey: Buffer.from(k, "base64").toString("utf-8"),
  type: kty,
});
