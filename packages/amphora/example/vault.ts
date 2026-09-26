// @lindorm/logger is a peer dependency — install it alongside @lindorm/amphora.
import { Amphora } from "../src/index.js";
import { KryptosKit } from "@lindorm/kryptos";
import { Logger } from "@lindorm/logger";

const amphora = new Amphora({
  internal: { issuer: "https://auth.example.com" },
  logger: new Logger({ level: "warn", readable: true }),
});

const token = KryptosKit.generate.sig.ec({
  algorithm: "ES512",
  purpose: "token",
  publish: true,
});

const recipient = KryptosKit.generate.enc.okp({
  algorithm: "ECDH-ES",
  curve: "X25519",
  publish: true,
});

const kek = KryptosKit.generate.enc.oct({ algorithm: "A256KW", purpose: "message" });

amphora.add([token, recipient, kek]);

const publishedKids = amphora.jwks.keys.map((jwk) => jwk.kid);

console.log("issuer         > ", amphora.internal?.issuer);
console.log("jwksUri        > ", amphora.internal?.jwksUri);
console.log("vault          > ", amphora.vault.length);
console.log("published kids > ", publishedKids);

console.log("canSign        > ", amphora.canSign());
console.log("canVerify      > ", amphora.canVerify());
console.log("canEncrypt     > ", amphora.canEncrypt());
console.log("canDecrypt     > ", amphora.canDecrypt());

console.log("signing key    > ", amphora.findSync({ use: "sig" }).id);
console.log("published enc  > ", amphora.filterSync({ use: "enc" }).length);

// The publish gate hides our own unpublished keys until a query names `publish`.
const unpublished = amphora.filterSync({ use: "enc", publish: false }).map((k) => k.id);

console.log("naming publish reaches the KEK > ", unpublished);
console.log("findById is ungated            > ", amphora.findByIdSync(kek.id).id);

const key = await amphora.find({ algorithm: { $in: ["ES256", "ES384", "ES512"] } });

console.log("operator query > ", key.algorithm);

amphora.env(KryptosKit.env.export(KryptosKit.generate.sig.okp({ algorithm: "EdDSA" })));

console.log("vault after env import > ", amphora.vault.length);
