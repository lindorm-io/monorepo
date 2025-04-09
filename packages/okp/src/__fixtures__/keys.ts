import { IKryptosOkp, KryptosKit } from "@lindorm/kryptos";

export const TEST_OKP_KEY_ED25519 = KryptosKit.from.b64({
  id: "78254bd8-6a5d-5b6f-98da-0d3539fa54be",
  algorithm: "EdDSA",
  curve: "Ed25519",
  privateKey: "MC4CAQAwBQYDK2VwBCIEIBwKJlvoh1ngd9LRd7dtvGOSqW4uZamdvIu0ABD2AkxL",
  publicKey: "MCowBQYDK2VwAyEAGRCwCA6lChosFGMQwxGiHCdzblfvCz0FNiRtTnm1qqc",
  type: "OKP",
  use: "sig",
}) as IKryptosOkp;

export const TEST_OKP_KEY_ED448 = KryptosKit.from.b64({
  id: "83b0bdda-f518-5308-942f-28452b2a524b",
  algorithm: "EdDSA",
  curve: "Ed448",
  privateKey:
    "MEcCAQAwBQYDK2VxBDsEOWXfvLsRxF0O-lEr1GACk5KKYEaFxKRJEzVO3S5-Y7xTRoKKIB0OUEjvKh3QpKhgJHNTcfRqbXj0nA",
  publicKey:
    "MEMwBQYDK2VxAzoA95RWzYLHRbQMEYUKuDAdNQEZ4kad9ySV8tRX12v0SUN8ZdsGH5lDUK8V2d7w-i9YDMnWVh-aNX-A",
  type: "OKP",
  use: "sig",
}) as IKryptosOkp;
