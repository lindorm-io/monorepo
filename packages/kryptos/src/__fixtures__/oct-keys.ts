import { OctJwk, OctString } from "../types";

export const TEST_OCT_KEY_B64: OctString = {
  id: "d8e83070-b906-5540-9933-01fe89037168",
  algorithm: "HS512",
  privateKey:
    "diYnyceZxmn18xGjVobBEwOSj2QOavHfv_tWGNuBpjND572Pa3qD8PDqDSrvoLtLOWyHdQ5lsmsuEIDcPgbPKp92HfNkawbKpCsVNBpoTlbZ-5jewLMREoGje9_pQzGSPLgh-cAkwtcrLUJNbwbyMGMlXmIJXeGukWsD6BfOAimNzPIyLf8QYMJYL9tzf16X4mQ1SvU76Y8Mqop6wz8ylAET7xWTivI-iOK8Zk1MiiomJww5w47Uz7X6Ha_uz7ctCESsyYMef9ZnYlsqwsHPrnP78ihyiv8cH7obubKJ6HkmsCnSTBOchDYxnmQiVZffuMSb8pScaIK6Vfef_1c7Vg",
  type: "oct",
  use: "sig",
};

export const TEST_OCT_KEY_JWK: OctJwk = {
  kid: "5c42d670-5db6-5bef-8093-a8e18a89d6c4",
  alg: "HS512",
  k: "tt8sKlXAatelhbSo_IZgvyFzIiKPOKhv-IZTqAEkCkJZPVrO5PK9hb1NH9m9bJXa1nGmqlEVCjzsA1lwYsA2clgUvjQ3QlL3x7yDxzZqReg2x_W4XezFU2fBsGdsD2u-CW5FJ3WJZPsSDG5zOsARCdjvIyDiNO1Ryb-MRb0LWxcvsDdzNPIJNTf5adhf4Qsf5ZIWhvnSF5y9fglB6QRcskgwdRfGoYjjkiw3-h5UDrUnjzCPLQ7GVhq2gg_OyZJsduwTVYGObpAG6EYplvQZjNAWyekHivXfpc556jNTWCzfmAyZvvucsGIM5wuupicfn7AbA1a50fuppCyMwbBKSg",
  kty: "oct",
  use: "sig",
};

export const TEST_OCT_KEY_PEM: OctString = {
  id: "737b2dcd-f6d0-5535-86f0-956ecfa8b983",
  algorithm: "HS512",
  privateKey:
    "-----BEGIN OCT PRIVATE KEY-----\n" +
    "ts4FwuyVlXJqw2ruyxbpzRpkknqiZicDS02J2YjfX+FwZ423Q42E0T/AKYkVXHNW\n" +
    "uD8Gi0aKMYytagkT7qJx3PsFCgDND01mXOg8pDhXv1n1Cbl8JxavKwbx87QCZ9Bm\n" +
    "PlUCPWDU8khZ/djxbtK/Hdl7ehFnk3KoFsEYphydCFhdI29UaURoj1ZNDV08Psnu\n" +
    "iqBCE9DgYc58QHaGRmpct9ORyYOJ4o+7jOD45cxeKZubVq4HIifiXk724DGP4M1/\n" +
    "crSKuYK1lddiniPwv/nnl0DAxI8/5Vz8NGXvGoJFaltQiZmKMC8y5O74DvIDknS3\n" +
    "cvQHzpn+t5VXn6eD+7A74Q==\n" +
    "-----END OCT PRIVATE KEY-----",
  use: "sig",
  type: "oct",
};

export const TEST_OCT_KEY_UTF: OctString = {
  id: "19a58ae7-b62c-51be-8bd5-cc417002cee4",
  algorithm: "HS512",
  privateKey: "#€!.abcdefghijklmnopqrstuvwxyz.ABCDEFGHIJKLMNOPQRSTUVWXYZ.0123456789",
  type: "oct",
  use: "sig",
};
