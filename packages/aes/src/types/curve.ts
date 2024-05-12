import { EcCurve } from "@lindorm/kryptos";

type SpecificCurve = "secp256k1" | "secp384r1" | "secp521r1";

export type AesCurve = EcCurve | SpecificCurve;
