import { KryptosB64, KryptosDer, KryptosJwk, KryptosPem } from "./combined";
import { JwkMetadata, LindormJwkMetadata } from "./jwk";

export type KryptosFromJwk = KryptosJwk & Partial<JwkMetadata> & Partial<LindormJwkMetadata>;

export type KryptosFrom = KryptosB64 | KryptosDer | KryptosFromJwk | KryptosPem;
