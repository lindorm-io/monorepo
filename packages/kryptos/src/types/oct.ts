export type OctSigAlgorithm = "HS256" | "HS384" | "HS512";

export type OctEncAlgorithm = "dir" | "A128KW" | "A192KW" | "A256KW";

export type OctAlgorithm = OctSigAlgorithm | OctEncAlgorithm;

export type OctSize = 16 | 24 | 32;

export type OctKeyJwk = {
  k: string;
  kty: "oct";
};
