import { IKryptosOkp } from "../interfaces";
import { KryptosKit } from "../classes";

export const MOCK_KRYPTOS_OKP_SIG_ED25519 = KryptosKit.from.b64({
  id: "96cc6942-bfde-4c7d-8ee4-4357208c9db8",
  algorithm: "EdDSA",
  curve: "Ed25519",
  type: "OKP",
  use: "sig",
  privateKey: "MC4CAQAwBQYDK2VwBCIEIKmxXx59ygVcRkVnccnP0NgAMsp-P4Uki4EniFJYkZDP",
  publicKey: "MCowBQYDK2VwAyEALTv3N8jJJxlOXWk-K9ttyuPR5BdxGtXThz5kfgE3ljk",
}) as IKryptosOkp;

export const MOCK_KRYPTOS_OKP_SIG_ED448 = KryptosKit.from.b64({
  id: "d0cc2689-06da-4d79-823d-254fb83229aa",
  algorithm: "EdDSA",
  curve: "Ed448",
  type: "OKP",
  use: "sig",
  privateKey:
    "MEcCAQAwBQYDK2VxBDsEOQE6do13pkptRR80-JwibjNn3LblewGIKUJVmhyhkiSIiI7BXRSg29sAUkAqWFtAYYVID-2vI7s0iw",
  publicKey:
    "MEMwBQYDK2VxAzoAlWHtbQMwQxyuQD7jOA96NKwvrUGUJNETNgkLNdTT0rEPsGHXN4bo6vu5lgnT3XGdzOak1jp36eeA",
}) as IKryptosOkp;

export const MOCK_KRYPTOS_OKP_ENC_X25519 = KryptosKit.from.b64({
  id: "ff61bfad-6921-469d-b59d-a9ef83d69453",
  algorithm: "ECDH-ES",
  curve: "X25519",
  type: "OKP",
  use: "enc",
  privateKey: "MC4CAQAwBQYDK2VuBCIEICizLexQYhpOkZ7f0aWOd5ZUDI1jNCBPhT-GmRSdgvdK",
  publicKey: "MCowBQYDK2VuAyEAYLW85U4Gr3rBcD2aTSPNn55dxXRt-gVo9dG-sgqYMmw",
}) as IKryptosOkp;

export const MOCK_KRYPTOS_OKP_ENC_X448 = KryptosKit.from.b64({
  id: "8d2fa4c3-9183-4931-8545-a92416338b59",
  algorithm: "ECDH-ES",
  curve: "X448",
  type: "OKP",
  use: "enc",
  privateKey:
    "MEYCAQAwBQYDK2VvBDoEOIBkPWTvnQg9bZbxraOXQ9wBunaLy6Evk4P32mBiSrfcaZFghwPSaujM8igbcOKEaXydFh6SqPrU",
  publicKey:
    "MEIwBQYDK2VvAzkAAwnWkcFaIROIMnDkE-8Ljz2oIlwLFYRTYuGtMqtD_SMj1HbRmI3LrOyDPxnb-1V40r7x7ZinTv0",
}) as IKryptosOkp;
