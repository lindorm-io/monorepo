import { createMockMongoRepository } from "@lindorm-io/mongo";
import { PublicKey } from "../../entity";
import { createTestClient, createTestPublicKey } from "../../fixtures/entity";
import { updateClientPublicKeyController } from "./update-client-public-key";

const NEW_RSA_KEY_SET = {
  id: "f6613598-5256-4f04-a0d3-13ef10aab160",
  publicKey:
    "-----BEGIN RSA PUBLIC KEY-----\n" +
    "MIIBCgKCAQEAssmAzxaL7hzUrtHylFXzWaw1rIOmdD/0bC2amcsTlJnIYL+uLQX3\n" +
    "vIxmEhXU8zkgW50O6T1ZO8VEj8QWwY3bdbxDkMTj156U+R8wysMAvZeZHKdMVLUS\n" +
    "xqWSYcpVuwh6+XjkIv6O8ZXjY52XfJOq5TNgVFQTSLkgTtjCvwtl/TcerHhtJhSC\n" +
    "jm3r4NLFtBFigmn+HObhOCgatvhaBzoUqJd8k884LQYoq1yoNjd5yX5OIeKNEBuK\n" +
    "8968xeY6zlOnxGOGgjlcwl3skgUImL/KwxiW1XGOUDA182BlKTVDGRfR87IGwWY4\n" +
    "qr1R2ToFFPjTq9HtbeBs3XgYZ0qPQPFyGwIDAQAB\n" +
    "-----END RSA PUBLIC KEY-----\n",
  type: "RSA",
  privateKey:
    "-----BEGIN RSA PRIVATE KEY-----\n" +
    "MIIEowIBAAKCAQEAssmAzxaL7hzUrtHylFXzWaw1rIOmdD/0bC2amcsTlJnIYL+u\n" +
    "LQX3vIxmEhXU8zkgW50O6T1ZO8VEj8QWwY3bdbxDkMTj156U+R8wysMAvZeZHKdM\n" +
    "VLUSxqWSYcpVuwh6+XjkIv6O8ZXjY52XfJOq5TNgVFQTSLkgTtjCvwtl/TcerHht\n" +
    "JhSCjm3r4NLFtBFigmn+HObhOCgatvhaBzoUqJd8k884LQYoq1yoNjd5yX5OIeKN\n" +
    "EBuK8968xeY6zlOnxGOGgjlcwl3skgUImL/KwxiW1XGOUDA182BlKTVDGRfR87IG\n" +
    "wWY4qr1R2ToFFPjTq9HtbeBs3XgYZ0qPQPFyGwIDAQABAoIBAA8j/WKMOEFr857y\n" +
    "bKafOMKJUOpRI9GIcPyQSB1qEzhsZYm78dYiQT6YbTRu4N/QIKthe5fI+DuVkx7R\n" +
    "rlOp3cH0tYwXAGyMI3WNbKZfKTrlEbRZfp9VzkdAUksxxVzXdQKXeEp2YEiZNu6C\n" +
    "tAd6wegzF59Ml217L/89YBCpuHNfCOY7zEqM6gO45aOM43GOTQp87U1kwolYaezm\n" +
    "pGi9/Bg6LOJNXBARp10qdRNpj+OCJ3m1rd536W39odjnVuc+JmR5AYFfwOZ8RnCd\n" +
    "NFiUnoU2GmR8VEzbyT3y+ZyZI17hPs2ZAEt6bOVFT7krpPp9fa2IPFZKt2wNhBvl\n" +
    "K8DSRHECgYEAtf/+tVoiBj6hyV6ldlmD5/x9HVDzamrj15QpI/X2opi4NxTVM8Q4\n" +
    "sWpw3pt9eOVEfdFuI/hoLeiJUnQ6XejcKPfeMsjvS6cZycw4rigEFqeXY18iewMS\n" +
    "EynI+2YPzZqRXuIoLKtMdlk4x4OLkcamPk85tnNqZMQXW/C0AvkI/60CgYEA+3sW\n" +
    "nWV92kmTD2RDT/qfQXmQorI1tFRHtY901fgPeAxyRTJ8/6N89K3JdWJUviTM6SLr\n" +
    "zergS4VVm3b6kB2ZjZ9v7O/v1NrR4oYpHWEZGrMjfbKzaNtGQs+ri1yelm1uHAkn\n" +
    "DgCSl56hjdFrvsMXoGKAskuYLZw9lKMt255BUecCgYEAl/oq8blQTDKk2wij1s4t\n" +
    "Ld1ThNWCTkzv8acRK6xKxcANpEFLP60NQmmF0v24qumYZhAqjvLx29QgR7AyxRSc\n" +
    "M8G31GSiHmRtTmuwsQ1NTLWp3xskKeCIiWQNJpE1hRUba0YjEhoBAZrDpScdtx9Q\n" +
    "1xtFMCv0nix47Rd02j6m2wkCgYAbiy2864LPR8OtqeOdfOu4diIbT72GFL0N67p2\n" +
    "PQcktOhHH/KE5VkoS2iHTM/PS6SN3F9LXHBYlS/9KRjkc/l/g3j00IrKG3VlhCA4\n" +
    "sYvYWsqGV+5Ci9G0O56kUu6jtzSaKX53kCR+KsezCr7sU93gmSlTXeg7BqPQBddd\n" +
    "+IVa/QKBgGFJ47UlExqmh8TO+yUXv+W0bLBpIuVfVEuTAMZrkYwAD2thi3Cvl/ru\n" +
    "jWrXXrf8WsmzLk1ZsdH9XBjXQQaBp/wey8EGZ4y6zLCFwUHeWWiHFO39qE9TXuDd\n" +
    "Mlof+m27sNFxdZtK8WGFd4JRMxR/aaNWnG8wjHRN6ZHLh31sz7S6\n" +
    "-----END RSA PRIVATE KEY-----\n",
};

describe("updateClientPublicKeyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        publicKey: NEW_RSA_KEY_SET.publicKey,
      },
      entity: {
        client: createTestClient(),
        publicKey: createTestPublicKey(),
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
        publicKeyRepository: createMockMongoRepository(createTestPublicKey),
      },
    };
  });

  test("should update a client public key", async () => {
    await expect(updateClientPublicKeyController(ctx)).resolves.toStrictEqual({
      body: {
        publicKeyId: expect.any(String),
      },
    });

    expect(ctx.mongo.clientRepository.update).toHaveBeenCalled();
    expect(ctx.mongo.publicKeyRepository.destroy).toHaveBeenCalled();
    expect(ctx.mongo.publicKeyRepository.create).toHaveBeenCalledWith(expect.any(PublicKey));
  });
});
