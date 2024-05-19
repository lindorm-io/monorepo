type CbcEncryption = "A128CBC-HS256" | "A192CBC-HS384" | "A256CBC-HS512";
type GcmEncryption = "A128GCM" | "A192GCM" | "A256GCM";

export type KryptosEncryption = CbcEncryption | GcmEncryption;
