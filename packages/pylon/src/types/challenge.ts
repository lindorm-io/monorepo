/** RFC 6750 §3.1 — the Bearer error codes. */
export type BearerError = "invalid_request" | "invalid_token" | "insufficient_scope";

/** RFC 9449 §7.1 — DPoP adds two codes to the Bearer set, and reuses the rest. */
export type DpopError = BearerError | "invalid_dpop_proof" | "use_dpop_nonce";

export type ChallengeParams = {
  /** RFC 7617 — Basic defines no error param. */
  basic: {
    realm?: string;
    charset?: "UTF-8";
  };
  bearer: {
    realm?: string;
    error?: BearerError;
    errorDescription?: string;
    scope?: string;
  };
  dpop: {
    realm?: string;
    error?: DpopError;
    errorDescription?: string;
    algs?: Array<string>;
    /** RFC 9449 §8 — carried in the DPoP-Nonce header, never as an auth-param. */
    nonce?: string;
  };
};

export type ChallengeScheme = keyof ChallengeParams;

export type PylonChallenge = <S extends ChallengeScheme>(
  scheme: S,
  params?: ChallengeParams[S],
) => void;
