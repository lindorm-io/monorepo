import { KeyPair, KeyPairOptions } from "../entities";
import { KeyPairAlgorithm, KeyPairType, NamedCurve } from "../enums";

export const createTestKeyPairEC = (options: Partial<KeyPairOptions> = {}): KeyPair =>
  new KeyPair({
    id: "7531da89-12e9-403e-925a-5da49100635c",
    algorithms: [KeyPairAlgorithm.ES512],
    created: new Date("2020-01-01T08:00:00.000Z"),
    expiresAt: new Date("2029-01-01T08:00:00.000Z"),
    isExternal: false,
    namedCurve: NamedCurve.P521,
    notBefore: new Date("2020-01-01T08:00:00.000Z"),
    originUri: "https://example.com",
    ownerId: "783f4859-562e-41e5-9c81-a392c12344c0",
    privateKey:
      "-----BEGIN PRIVATE KEY-----\n" +
      "MIHuAgEAMBAGByqGSM49AgEGBSuBBAAjBIHWMIHTAgEBBEIBGma7xGZpaAngFXf3\n" +
      "mJF3IxZfDpI+6wU564K+eehxX104v6dZetjSfMx0rvsYX/s6cO2P3GE7R95VxWEk\n" +
      "+f4EX0qhgYkDgYYABAB8cBfDwCi41G4kVW4V3Y86nIMMCypYzfO8gYjpS091lxkM\n" +
      "goTRS3LM1p65KQfwBolrWIdVrbbOILASf06fQsHw5gEt4snVuMBO+LS6pesX9vA8\n" +
      "QT1LjX75Xq2InnLY1VToeNmxkuM+oDZgqHOYwzfUhu+zZaA5AuEkqPi47TA9iCSY\n" +
      "VQ==\n" +
      "-----END PRIVATE KEY-----\n",
    publicKey:
      "-----BEGIN PUBLIC KEY-----\n" +
      "MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQAfHAXw8AouNRuJFVuFd2POpyDDAsq\n" +
      "WM3zvIGI6UtPdZcZDIKE0UtyzNaeuSkH8AaJa1iHVa22ziCwEn9On0LB8OYBLeLJ\n" +
      "1bjATvi0uqXrF/bwPEE9S41++V6tiJ5y2NVU6HjZsZLjPqA2YKhzmMM31Ibvs2Wg\n" +
      "OQLhJKj4uO0wPYgkmFU=\n" +
      "-----END PUBLIC KEY-----\n",
    type: KeyPairType.EC,
    updated: new Date("2021-01-01T10:00:00.000Z"),
    ...options,
  });

export const createTestKeyPairHS = (options: Partial<KeyPairOptions> = {}): KeyPair =>
  new KeyPair({
    id: "aa08b86a-3550-4893-8021-9a18efcd1532",
    algorithms: [KeyPairAlgorithm.HS512],
    created: new Date("2020-01-01T07:00:00.000Z"),
    expiresAt: new Date("2029-01-01T08:00:00.000Z"),
    isExternal: false,
    notBefore: new Date("2020-01-01T07:00:00.000Z"),
    originUri: "https://example.com",
    ownerId: "6e0e4a96-8bf6-46ab-90f4-17c3c3abf174",
    privateKey:
      "w(Hr~(~DwknfWryBEsAmJwO0*5Urs_10vsL2dllJdTVc.C3j_fF36a-Xsji.8g*)w(9j0C-2rlp2fCXsK1fxA_).*6NG70vloV3h)*do0!T44PB7099S21y7~2--h5)~",
    publicKey:
      "w(Hr~(~DwknfWryBEsAmJwO0*5Urs_10vsL2dllJdTVc.C3j_fF36a-Xsji.8g*)w(9j0C-2rlp2fCXsK1fxA_).*6NG70vloV3h)*do0!T44PB7099S21y7~2--h5)~",
    type: KeyPairType.HS,
    updated: new Date("2021-01-01T10:00:00.000Z"),
    ...options,
  });

export const createTestKeyPairRSA = (options: Partial<KeyPairOptions> = {}): KeyPair =>
  new KeyPair({
    id: "e6301473-e347-4035-8084-8645d034e4a3",
    algorithms: [KeyPairAlgorithm.RS256, KeyPairAlgorithm.RS384, KeyPairAlgorithm.RS512],
    created: new Date("2020-01-01T07:00:00.000Z"),
    expiresAt: new Date("2029-01-01T08:00:00.000Z"),
    isExternal: false,
    notBefore: new Date("2020-01-01T07:00:00.000Z"),
    originUri: "https://example.com",
    ownerId: "ffe189e0-c82e-42d1-84ea-1bf4d4d07117",
    passphrase: null,
    privateKey:
      "-----BEGIN RSA PRIVATE KEY-----\n" +
      "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\n" +
      "-----END RSA PRIVATE KEY-----\n",
    publicKey:
      "-----BEGIN RSA PUBLIC KEY-----\n" +
      "MIICCgKCAgEA8h//VGbmGCMm/cywfEEviNkR7o3yL0yZktzqb95VtwsGatj3JbOp\n" +
      "u7FwePJww0CBVZw3zE+bnNcVyaZFMfhm8uNEBOA5JQBWs2ZJhflIGz4oYWcWeMto\n" +
      "cwh0kNVLtz1071a9O7JOAVR64KslbactXAeSIcMk7c9reKffVgymZnTTNHMhECtb\n" +
      "z77RCUpgLgEG/PUU44N9cYWtPfOvUnxrA6ocxG8Y+IggG6TYtiDwTBScypg9u59/\n" +
      "xLLevM+SRwGomM3dyx6h4W3DnT8kwIRrBvsNhmmqoMEOjQYPbfVHP/RkES9pdIFy\n" +
      "2jdw4TrLFhwU9dSgQLpZ5EK+7CylcbdhgNqo/Bm0XgiKFKPeYvspNXXVuaVRGhop\n" +
      "z3HmEQyaCrDjvX7GF4BJ4j26rotqKxurZDNOEKuLUWwRle/Ft6/zbbrUXdV2rBvr\n" +
      "mx+YW8aKJiUpJhgT8rSRZeLZ/CJ+G8ZONp2bqvZqkeRhg3XcvyrBcdeT947FOFz5\n" +
      "wZg8mnBNnDJeVs+kdUh9FP3q0T/DVcf0ebED2pxhMjmAq7oa+Gk5UPU61+EdP9pC\n" +
      "sJrjyzu7watHSkszd8MetQ8MRUWzhplnsFJI16AKvNN03FWNk2eTd36Tzm/7SX8I\n" +
      "FDpORQUua2TivVRvRWWpl6wC0w7/oajFii+iDDdA4h4BjPAgvjmx38cCAwEAAQ==\n" +
      "-----END RSA PUBLIC KEY-----\n",
    type: KeyPairType.RSA,
    updated: new Date("2021-01-01T09:00:00.000Z"),
    ...options,
  });

export const createTestKeyPair = createTestKeyPairEC;
