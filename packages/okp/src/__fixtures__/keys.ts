import { IKryptosOkp, Kryptos } from "@lindorm/kryptos";

export const TEST_OKP_KEY_25519 = Kryptos.make({
  algorithm: "EdDSA",
  curve: "Ed25519",
  privateKey: "MC4CAQAwBQYDK2VwBCIEIBwKJlvoh1ngd9LRd7dtvGOSqW4uZamdvIu0ABD2AkxL",
  publicKey: "MCowBQYDK2VwAyEAGRCwCA6lChosFGMQwxGiHCdzblfvCz0FNiRtTnm1qqc",
  type: "OKP",
  use: "sig",
}) as IKryptosOkp;

export const TEST_OKP_KEY_448 = Kryptos.make({
  algorithm: "EdDSA",
  curve: "Ed448",
  privateKey:
    "MEcCAQAwBQYDK2VxBDsEOWXfvLsRxF0O-lEr1GACk5KKYEaFxKRJEzVO3S5-Y7xTRoKKIB0OUEjvKh3QpKhgJHNTcfRqbXj0nA",
  publicKey:
    "MEMwBQYDK2VxAzoA95RWzYLHRbQMEYUKuDAdNQEZ4kad9ySV8tRX12v0SUN8ZdsGH5lDUK8V2d7w-i9YDMnWVh-aNX-A",
  type: "OKP",
  use: "sig",
}) as IKryptosOkp;
