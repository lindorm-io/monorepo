import { OkpCurve } from "../../../types";

export const isOkpCurve = (curve: any): curve is OkpCurve =>
  curve === "Ed25519" || curve === "Ed448" || curve === "X25519" || curve === "X448";
