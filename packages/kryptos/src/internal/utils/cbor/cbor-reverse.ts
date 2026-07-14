import type {
  KryptosAlgorithm,
  KryptosCurve,
  KryptosEncryption,
  KryptosType,
  KryptosUse,
} from "../../../types/index.js";
import {
  CBOR_ALG,
  CBOR_CRV,
  CBOR_ENC,
  CBOR_KTY,
  CBOR_LABEL,
  CBOR_USE,
} from "../../constants/cbor-table.js";

// Invert a `name → integer` table into `integer → name` for decoding.
const invert = <T extends string>(table: Record<T, number>): Map<number, T> => {
  const reversed = new Map<number, T>();
  for (const [name, value] of Object.entries(table) as Array<[T, number]>) {
    reversed.set(value, name);
  }
  return reversed;
};

export const REV_KTY = invert<KryptosType>(CBOR_KTY);
export const REV_USE = invert<KryptosUse>(CBOR_USE);
export const REV_CRV = invert<KryptosCurve>(CBOR_CRV);
export const REV_ALG = invert<KryptosAlgorithm>(CBOR_ALG);
export const REV_ENC = invert<KryptosEncryption>(CBOR_ENC);
export const REV_LABEL = invert(CBOR_LABEL);
