export type PemData = {
  privateKey?: string;
  publicKey: string;
};

export type PemDataEcdh = PemData & {
  curve: EcdhCurve;
};

export type PemType = "EC" | "RSA";

export type EcdhCurve = "P-256" | "P-384" | "P-521";

export type PemToJwkOptions = {
  curve?: EcdhCurve;
  privateKey?: string;
  publicKey: string;
  type: PemType;
};
