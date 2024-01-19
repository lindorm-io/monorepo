import { CertificateMethod } from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { RsaKeySet } from "@lindorm-io/jwk";
import { randomString } from "@lindorm-io/random";
import { createRsaSignature } from "@lindorm-io/rsa";
import { PublicKey } from "../entity";
import { RSA_KEY_SET } from "../fixtures/integration/rsa-keys.fixture";
import { assertCertificateChallenge } from "./assert-certificate-challenge";
import { mapCertificateMethodToRsaAlgorithm } from "./certificate-method-mapper";

const sign = (input: string, method: CertificateMethod = CertificateMethod.SHA256): string =>
  createRsaSignature({
    algorithm: mapCertificateMethodToRsaAlgorithm(method),
    data: input,
    keySet: RSA_KEY_SET,
  });

describe("assertCertificateChallenge", () => {
  let certificateChallenge: string;
  let certificateMethod: CertificateMethod;
  let publicKey: PublicKey;

  beforeAll(() => {
    certificateChallenge = randomString(32);
    publicKey = PublicKey.fromKeySet(RSA_KEY_SET);
  });

  test("should verify a signed challenge for SHA256", async () => {
    certificateMethod = CertificateMethod.SHA256;

    expect(() =>
      assertCertificateChallenge({
        certificateChallenge,
        certificateMethod,
        certificateVerifier: sign(certificateChallenge, certificateMethod),
        publicKey,
      }),
    ).not.toThrow();
  });

  test("should verify a signed challenge for SHA384", async () => {
    certificateMethod = CertificateMethod.SHA384;

    expect(() =>
      assertCertificateChallenge({
        certificateChallenge,
        certificateMethod,
        certificateVerifier: sign(certificateChallenge, certificateMethod),
        publicKey,
      }),
    ).not.toThrow();
  });

  test("should verify a signed challenge for SHA512", async () => {
    certificateMethod = CertificateMethod.SHA512;

    expect(() =>
      assertCertificateChallenge({
        certificateChallenge,
        certificateMethod,
        certificateVerifier: sign(certificateChallenge, certificateMethod),
        publicKey,
      }),
    ).not.toThrow();
  });

  test("should throw on invalid challenge", async () => {
    certificateMethod = CertificateMethod.SHA256;

    expect(() =>
      assertCertificateChallenge({
        certificateChallenge: randomString(32),
        certificateMethod,
        certificateVerifier: sign(certificateChallenge, certificateMethod),
        publicKey,
      }),
    ).toThrow(ClientError);
  });

  test("should throw on invalid method", async () => {
    expect(() =>
      assertCertificateChallenge({
        certificateChallenge,
        certificateMethod: CertificateMethod.SHA384,
        certificateVerifier: sign(certificateChallenge, CertificateMethod.SHA256),
        publicKey,
      }),
    ).toThrow(ClientError);
  });

  test("should throw on invalid verifier method", async () => {
    certificateMethod = CertificateMethod.SHA256;

    expect(() =>
      assertCertificateChallenge({
        certificateChallenge,
        certificateMethod,
        certificateVerifier: sign(certificateChallenge, CertificateMethod.SHA384),
        publicKey,
      }),
    ).toThrow(ClientError);
  });

  test("should throw on invalid verifier challenge", async () => {
    certificateMethod = CertificateMethod.SHA256;

    expect(() =>
      assertCertificateChallenge({
        certificateChallenge,
        certificateMethod,
        certificateVerifier: sign(randomString(32), certificateMethod),
        publicKey,
      }),
    ).toThrow(ClientError);
  });

  test("should throw on invalid public key", async () => {
    certificateMethod = CertificateMethod.SHA256;

    expect(() =>
      assertCertificateChallenge({
        certificateChallenge,
        certificateMethod,
        certificateVerifier: sign(certificateChallenge, certificateMethod),
        publicKey: PublicKey.fromKeySet(
          RsaKeySet.fromPem({
            id: "ignored",
            publicKey:
              "-----BEGIN RSA PUBLIC KEY-----\n" +
              "MIICCgKCAgEAybQm2T+bls/+8+gBZ36r2FGbfytCUjpLT/bRZPsg4W7SEeCVUexh\n" +
              "28UaUyZSTQGxqWbwZR9Tdmh/W5PDjo+P0bORrdbT2pYkDVVlXoODYN1WLswBEuOD\n" +
              "arCsVDhBhpSbo7DkKJrzrQFjdmRjAqd5Ekl4uftqggIP8B5U797PylljmmFe5h7D\n" +
              "wdR19WpOndnDQA1go1rx/qV7Uc9Vgf1Tin5k72G8J/RVT4CJvOs7vV2AF5XXXCQl\n" +
              "+YmDXBKJ10yxqhbCO+6uSPERyZkczGHlaYlzrvB013B78Ll9s+EFatHHttQvzO9p\n" +
              "BUsS5rhcc4aQTA2kSSHF2UoHmKd25kvL8e8xYOhqoYp+7hC3QHKUblh7G5jseUWu\n" +
              "RfkwTv9XPWQPCiYFCFP6rAl88AD8XbkHaGz47X42tzTfqz/j9VTMqSfGwwlIkpCC\n" +
              "I+ssZ2DVlzsKlx2hIFyNMRwSOWRHVwflvDB3smd69wNiwDJjl+0LWydgDl/g3KkC\n" +
              "LpsE/2mU6/EWZTkMgFfp7XAjOuz9hQzuf13uKx/5bjKYTTD7ev8guqlfsSBugDJg\n" +
              "c0VoYkOtd30YENBRdpmE20MNkHnzzFd9bjm4j4ZaIU3xZDe9me/5mInqZuILcl90\n" +
              "GFeCXe7QQ+mEe55+DNs1jV3Z1pZj7eG2hmAJBLSMF7ksee46okGD6D0CAwEAAQ==\n" +
              "-----END RSA PUBLIC KEY-----\n",
            type: "RSA",
          }),
        ),
      }),
    ).toThrow(ClientError);
  });
});
