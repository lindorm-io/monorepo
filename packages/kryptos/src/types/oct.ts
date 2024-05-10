export type OctKeySize = 16 | 24 | 32;

export type OctKeyJwk = {
  k: string;
  kty: "oct";
};
