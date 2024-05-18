import { IKryptosOct, Kryptos, KryptosFromB64 } from "@lindorm/kryptos";

const OCT: KryptosFromB64 = {
  algorithm: "HS512",
  privateKey:
    "diYnyceZxmn18xGjVobBEwOSj2QOavHfv_tWGNuBpjND572Pa3qD8PDqDSrvoLtLOWyHdQ5lsmsuEIDcPgbPKp92HfNkawbKpCsVNBpoTlbZ-5jewLMREoGje9_pQzGSPLgh-cAkwtcrLUJNbwbyMGMlXmIJXeGukWsD6BfOAimNzPIyLf8QYMJYL9tzf16X4mQ1SvU76Y8Mqop6wz8ylAET7xWTivI-iOK8Zk1MiiomJww5w47Uz7X6Ha_uz7ctCESsyYMef9ZnYlsqwsHPrnP78ihyiv8cH7obubKJ6HkmsCnSTBOchDYxnmQiVZffuMSb8pScaIK6Vfef_1c7Vg",
  publicKey: "",
  type: "oct",
  use: "sig",
};

export const TEST_OCT_KEY_SIG = Kryptos.from("b64", {
  ...OCT,
  algorithm: "HS256",
  createdAt: new Date("2024-01-01T00:03:00.000Z"),
  operations: ["sign", "verify"],
  use: "sig",
}) as IKryptosOct;

export const TEST_OCT_KEY_ENC = Kryptos.from("b64", {
  ...OCT,
  algorithm: "dir",
  createdAt: new Date("2024-01-01T00:04:00.000Z"),
  operations: ["encrypt", "decrypt", "deriveKey"],
  use: "enc",
}) as IKryptosOct;
