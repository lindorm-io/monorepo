import { KryptosKit } from "../src/index.js";

const key = KryptosKit.generate.sig.ec({ algorithm: "ES256", publish: true });

const jwk = key.export("jwk");
const pem = key.export("pem");
const b64 = key.export("b64");
const der = key.export("der");

console.log("jwk kty          > ", jwk.kty);
console.log("pem private head > ", pem.privateKey?.split("\n")[0]);
console.log("b64 public       > ", b64.publicKey);
console.log("der public bytes > ", der.publicKey?.length);

console.log("public jwk  > ", key.toJWK());
console.log("private jwk > ", key.toJWK("private"));
console.log("json        > ", key.toJSON());
console.log("row         > ", key.toDB());

const fromPem = KryptosKit.from.pem(pem);
const fromB64 = KryptosKit.from.b64(b64);
const fromDer = KryptosKit.from.der(der);
const fromJwk = KryptosKit.from.jwk(key.toJWK("private"));
const fromAuto = KryptosKit.from.auto(pem);
const fromDb = KryptosKit.from.db(key.toDB());

console.log("pem  id matches > ", fromPem.id === key.id);
console.log("b64  id matches > ", fromB64.id === key.id);
console.log("der  id matches > ", fromDer.id === key.id);
console.log("jwk  id matches > ", fromJwk.id === key.id);
console.log("auto id matches > ", fromAuto.id === key.id);
console.log("db   id matches > ", fromDb.id === key.id);

// A JWK arrives from a remote JWKS, so its provenance is foreign.
console.log("jwk internal > ", fromJwk.internal);
