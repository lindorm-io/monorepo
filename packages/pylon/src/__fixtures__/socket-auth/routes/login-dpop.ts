import { ClientError } from "@lindorm/errors";
import { KryptosKit } from "@lindorm/kryptos";
import { mintTestAccessToken } from "../mint-test-access-token";

type DpopProofHeader = {
  jwk?: Record<string, unknown>;
};

const decodeBase64UrlJson = <T>(segment: string): T => {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json) as T;
};

// Test-only: extract the jwk from an incoming DPoP proof header and compute
// its RFC 7638 thumbprint via KryptosKit, so the minted access token can be
// bound via cnf.jkt. Full proof signature / htu verification still happens
// at the socket handshake, so this fixture route intentionally only parses
// the proof header to pull out the public key material.
export const POST = async (ctx: any) => {
  const dpopHeaderRaw = ctx.headers?.dpop;
  const dpopHeader = Array.isArray(dpopHeaderRaw) ? dpopHeaderRaw[0] : dpopHeaderRaw;

  if (typeof dpopHeader !== "string" || dpopHeader.length === 0) {
    throw new ClientError("Missing DPoP header", {
      status: ClientError.Status.BadRequest,
    });
  }

  const parts = dpopHeader.split(".");
  if (parts.length !== 3) {
    throw new ClientError("Invalid DPoP proof", {
      status: ClientError.Status.BadRequest,
    });
  }

  const header = decodeBase64UrlJson<DpopProofHeader>(parts[0]);
  if (!header.jwk || typeof header.jwk !== "object") {
    throw new ClientError("Invalid DPoP proof: missing jwk", {
      status: ClientError.Status.BadRequest,
    });
  }

  // KryptosKit.from.jwk requires algorithm/use; DPoP proof headers only
  // carry the canonical (kty/crv/x/y) material. Inject ES256/sig so Kryptos
  // can construct the key and compute the thumbprint. The thumbprint itself
  // is JWK-canonical and not affected by these injected hints.
  const kryptos = KryptosKit.from.jwk({
    ...(header.jwk as any),
    alg: "ES256",
    use: "sig",
  });
  const jkt = kryptos.thumbprint;

  const subject = ctx.data?.subject ?? "alice";
  const expiresIn = ctx.data?.expiresIn ?? 3600;

  const minted = await mintTestAccessToken(ctx.aegis, { subject, expiresIn, jkt });

  ctx.body = {
    bearer: minted.token,
    expiresIn: minted.expiresIn,
    subject,
    jkt,
  };
  ctx.status = 200;
};
