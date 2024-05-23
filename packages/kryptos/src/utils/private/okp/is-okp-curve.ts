import { KryptosCurve, OkpCurve } from "../../../types";

export const isOkpCurve = (curve: KryptosCurve | undefined): curve is OkpCurve =>
  curve === "Ed25519" || curve === "Ed448" || curve === "X25519" || curve === "X448";
