import type { Jwks } from "./jwks/index.js";
import type { JwksAlgorithm } from "./jwks/jwks-algorithm.js";

// Abstract signer used to mint RFC 9449 DPoP proof JWTs. Consumers
// (e.g. conduit's DPoP auth middleware) build proofs by asking the
// signer to sign canonical JWS input bytes and embedding the public
// JWK in the proof's JOSE header.
//
// This is the contract boundary between lindorm packages that need a
// DPoP signer — it lives in @lindorm/types specifically so both
// node-backed and WebCrypto-backed implementations can be written
// without creating a dependency on @lindorm/kryptos (which pulls in
// node:crypto and is unsuitable for browser bundles).
//
// https://datatracker.ietf.org/doc/html/rfc9449
export type DpopSigner = {
  algorithm: JwksAlgorithm;
  publicJwk: Jwks;
  sign(data: Uint8Array): Promise<Uint8Array>;
};
