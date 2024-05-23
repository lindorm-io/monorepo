import { EcCurve, KryptosCurve } from "../../../types";

export const isEcCurve = (curve: KryptosCurve | undefined): curve is EcCurve =>
  curve === "P-256" || curve === "P-384" || curve === "P-521";
