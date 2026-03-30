import { EcCurve } from "../../../types";

export const isEcCurve = (curve?: any): curve is EcCurve =>
  curve === "P-256" || curve === "P-384" || curve === "P-521";
