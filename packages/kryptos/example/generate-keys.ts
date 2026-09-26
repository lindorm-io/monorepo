import { type KryptosAlgorithm, KryptosKit } from "../src/index.js";

const ec = KryptosKit.generate.sig.ec({ algorithm: "ES512" });

console.log("id         > ", ec.id);
console.log("algorithm  > ", ec.algorithm);
console.log("type       > ", ec.type);
console.log("curve      > ", ec.curve);
console.log("use        > ", ec.use);
console.log("operations > ", ec.operations);
console.log("algClass   > ", ec.algClass);
console.log("publish    > ", ec.publish);
console.log("expiresAt  > ", ec.expiresAt);

// generate.auto picks type, curve and content encryption from the algorithm alone.
const auto = (algorithm: KryptosAlgorithm) =>
  KryptosKit.generate.auto({ algorithm }).toString();

console.log("auto ES256        > ", auto("ES256"));
console.log("auto EdDSA        > ", auto("EdDSA"));
console.log("auto RSA-OAEP-256 > ", auto("RSA-OAEP-256"));
console.log("auto ML-DSA-65    > ", auto("ML-DSA-65"));
console.log("auto A256GCMKW    > ", auto("A256GCMKW"));

const rsa = await KryptosKit.generateAsync.auto({ algorithm: "RS256", modulus: 3072 });

console.log("modulus > ", rsa.modulus);

const published = KryptosKit.generate.sig.okp({
  algorithm: "EdDSA",
  curve: "Ed25519",
  issuer: "https://auth.example.com",
  jwksUri: "https://auth.example.com/.well-known/jwks.json",
  purpose: "token",
  publish: true,
});

console.log("published > ", published.publish);
console.log("isActive  > ", published.isActive);

const clone = KryptosKit.clone(published, { purpose: "cookie", publish: false });

console.log("clone purpose                 > ", clone.purpose);
console.log("clone keeps the thumbprint id > ", clone.id === published.id);
