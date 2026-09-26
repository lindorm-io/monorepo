import { KryptosKit } from "../src/index.js";

const seed = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });

const derive = (path: string) =>
  KryptosKit.from.derive({
    type: "oct",
    use: "enc",
    algorithm: "A256KW",
    deriveFrom: seed,
    path,
  });

const v1 = derive("urn:lindorm:tyr:kek:v1");
const again = derive("urn:lindorm:tyr:kek:v1");
const v2 = derive("urn:lindorm:tyr:kek:v2");

console.log("same seed and path reproduce the id > ", v1.id === again.id);
console.log("a bumped version rotates the key    > ", v1.id !== v2.id);

const fromPassphrase = KryptosKit.from.derive({
  type: "oct",
  use: "sig",
  algorithm: "HS256",
  deriveFrom: "correct horse battery staple",
});

console.log("passphrase key > ", fromPassphrase.toString());
