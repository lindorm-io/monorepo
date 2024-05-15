import { EcCurve, KryptosCurve } from "../../../types";

export const _isEcCurve = (curve: KryptosCurve | undefined): curve is EcCurve =>
  curve === "P-256" || curve === "P-384" || curve === "P-521";
