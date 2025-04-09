import { IKryptosOct, KryptosKit } from "@lindorm/kryptos";

export const TEST_OCT_KEY_HS256 = KryptosKit.from.b64({
  id: "db695f26-f059-433f-a3ab-d54663eccb8f",
  algorithm: "HS256",
  privateKey:
    "_V9fAX5IBxd8au8AWrlzl4xrn-2WobL_U7CPoFTXThtIjAwB-FEjzF_2I651IoqCAft5RKDPSxlDvoyUEqoAKg",
  type: "oct",
  use: "sig",
}) as IKryptosOct;

export const TEST_OCT_KEY_HS384 = KryptosKit.from.b64({
  id: "4f1fb9e5-52f5-45ce-8169-96fba8588cab",
  algorithm: "HS384",
  privateKey:
    "ikOQrJFHY9gkwd3adC2LeNNgs-nCkoxT432X0nXsJ7DxLzK2uH44MiMxelxMPyg5dN5KxCGzh_p18o1K28uSb5ByU6R6DdE91al_tPcJDlXmAvAO_VEgvsga5Czjq3nQ",
  type: "oct",
  use: "sig",
}) as IKryptosOct;

export const TEST_OCT_KEY_HS512 = KryptosKit.from.b64({
  id: "2400beec-f356-4ff6-b5e4-999fde56807a",
  algorithm: "HS512",
  privateKey:
    "pkN24D37OkCvIcjFJR4G6pMumdvtbYQVSBGkynkTZCqeAhGUyyYR-RMo3vg94fkXjYU-PBXO4ko0Wy1kxCcFJNMOeoTmN91K_nFaNrf4QOV574hr8T40OrGgmgRnSeqvT3UrjUFYum6oYsD6GrPKB6I0zSn1YEvoRSbOC5OTi8M",
  type: "oct",
  use: "sig",
}) as IKryptosOct;
