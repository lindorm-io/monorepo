export type OctAlgorithm = "HS256" | "HS384" | "HS512";

export type OctSize = 16 | 24 | 32;

export type OctKeyJwk = {
  k: string;
  kty: "oct";
};
