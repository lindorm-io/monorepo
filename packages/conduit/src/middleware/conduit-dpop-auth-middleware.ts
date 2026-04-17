import { buildDpopProof } from "../internal/build-dpop-proof";
import { DpopSigner } from "@lindorm/types";
import { ConduitMiddleware } from "../types";

export type ConduitDpopAuthOptions = {
  nonce?: string;
};

// Create a DPoP auth middleware bound to a long-lived client signer.
// The returned function takes a per-request access token (and optional
// server-issued nonce) and yields a middleware that signs a fresh DPoP
// proof per request.
//
// Usage:
//   const dpopAuth = createConduitDpopAuthMiddleware(signer);
//   client.get("/orders", { middleware: [dpopAuth(accessToken)] });
export const createConduitDpopAuthMiddleware =
  (signer: DpopSigner) =>
  (accessToken: string, options: ConduitDpopAuthOptions = {}): ConduitMiddleware =>
    async function conduitDpopAuthMiddleware(ctx, next) {
      const proof = await buildDpopProof({
        signer,
        httpMethod: ctx.req.config.method,
        httpUri: ctx.req.url,
        accessToken,
        nonce: options.nonce,
      });

      ctx.req.headers = {
        ...ctx.req.headers,
        Authorization: `DPoP ${accessToken}`,
        DPoP: proof,
      };

      await next();
    };
