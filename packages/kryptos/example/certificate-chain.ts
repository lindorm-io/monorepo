import { KryptosKit } from "../src/index.js";

const root = KryptosKit.generate.sig.ec({
  algorithm: "ES384",
  notBefore: new Date("2026-01-01"),
  expiresAt: new Date("2036-01-01"),
  certificate: {
    mode: "root-ca",
    subject: "Lindorm Root CA",
    organization: "Lindorm",
    environment: "development",
    pathLengthConstraint: 1,
  },
});

const issuing = KryptosKit.generate.sig.ec({
  algorithm: "ES256",
  certificate: {
    mode: "intermediate-ca",
    ca: root,
    subject: "Tyr Issuing CA",
    pathLengthConstraint: 0,
  },
});

const leaf = KryptosKit.generate.sig.ec({
  algorithm: "ES256",
  issuer: "https://tyr.lindorm.io",
  certificate: {
    mode: "ca-signed",
    ca: issuing,
    subject: "tyr.lindorm.io",
    subjectAlternativeNames: [
      { type: "dns", value: "tyr.lindorm.io" },
      { type: "uri", value: "https://tyr.lindorm.io" },
    ],
  },
});

const anchor = root.certificate("b64")!.chain[0];

leaf.verifyCertificate({ trustAnchors: anchor });

console.log("hasCertificate        > ", leaf.hasCertificate);
console.log("chain length          > ", leaf.certificate("b64")!.chain.length);
console.log("certificateThumbprint > ", leaf.certificateThumbprint);
console.log("x5c members           > ", leaf.certificate("jwk")!.x5c.length);
console.log("leaf pem head         > ", leaf.certificate("pem")!.chain[0].split("\n")[0]);

const parsed = leaf.parseCertificate();

console.log("subject CN   > ", parsed?.subject.commonName);
console.log("issuer CN    > ", parsed?.issuer.commonName);
console.log("OU inherited > ", parsed?.subject.organizationalUnit);
console.log("cA           > ", parsed?.extensions.basicConstraintsCa);
console.log("key usage    > ", parsed?.extensions.keyUsage);

console.log("jwk carries the chain > ", Boolean(leaf.toJWK().x5c));
