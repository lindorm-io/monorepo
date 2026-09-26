import { KryptosKit } from "../src/index.js";

const key = KryptosKit.generate.sig.okp({ algorithm: "EdDSA", curve: "Ed25519" });

const cbor = KryptosKit.env.export(key);
const json = KryptosKit.env.export(key, "json");

console.log("cbor        > ", cbor);
console.log("json        > ", json);
console.log("cbor bytes  > ", cbor.length);
console.log("json bytes  > ", json.length);

const fromCbor = KryptosKit.env.import(cbor);
const fromJson = KryptosKit.env.import(json);

console.log("cbor id matches > ", fromCbor.id === key.id);
console.log("json id matches > ", fromJson.id === key.id);
console.log("env is ours     > ", fromCbor.internal);
