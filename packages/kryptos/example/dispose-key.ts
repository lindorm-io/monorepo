import { KryptosError, KryptosKit } from "../src/index.js";

{
  using key = KryptosKit.generate.sig.ec({ algorithm: "ES256" });

  console.log("hasPrivateKey inside scope > ", key.hasPrivateKey);
}

const key = KryptosKit.generate.sig.ec({ algorithm: "ES256" });

key.dispose();

console.log("hasPrivateKey after dispose > ", key.hasPrivateKey);

try {
  key.export("der");
} catch (error) {
  console.log("export after dispose > ", error instanceof KryptosError, String(error));
}
