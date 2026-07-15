import type { AmphoraPredicate } from "@lindorm/amphora";
import { SignatureKit } from "@lindorm/aegis";
import { snakeKeys } from "@lindorm/case";
import { ClientError } from "@lindorm/errors";
import type { IKryptos } from "@lindorm/kryptos";
import { ShaKit } from "@lindorm/sha";
import type { Dict, DsaEncoding, ShaAlgorithm } from "@lindorm/types";
import { Predicated } from "@lindorm/utils";
import type { BinaryToTextEncoding } from "crypto";
import { z } from "zod";
import type { PylonHttpContext, PylonHttpMiddleware } from "../../types/index.js";

// The `kid` a signed request is verified against comes from the request's OWN
// Signature header, so the caller — potentially an attacker — chooses which key
// in the vault answers. The consumer's callback resolves it (typically via the
// unfiltered `findById`), so nothing else floors it: without this, a request
// could be "verified" against an `enc` key or a not-yet-valid key. It is the
// READ floor (`isPending: false`, not `isActive`): a key that has since expired
// must still verify a request it signed while valid, but a key whose `notBefore`
// has not passed cannot have signed anything, ever.
const SIGNED_REQUEST_VERIFY_FLOOR: AmphoraPredicate = {
  use: "sig",
  isPending: false,
};

export type GetSignedRequestKryptosCallback<
  C extends PylonHttpContext = PylonHttpContext,
> = (ctx: C, keyId: string) => Promise<IKryptos>;

type Options = {
  required?: boolean;
};

type DecodedDigest = {
  algorithm: ShaAlgorithm;
  encoding?: BinaryToTextEncoding;
  hash: string;
};

type DecodedSignature = {
  dsa?: DsaEncoding;
  encoding?: BufferEncoding;
  hash: string;
  headers: Array<string>;
  key: string;
};

const zodAlgorithm = z.enum(["SHA1", "SHA256", "SHA384", "SHA512"]);
const zodDsa = z.enum(["der", "ieee-p1363"]);
const zodEncoding = z.enum(["base64", "base64url", "hex"]);

const regexValue = (regexp: RegExp, digest: string): string | undefined =>
  new RegExp(regexp).exec(digest)?.groups?.value;

const decodeDigestHeader = (digest: string): DecodedDigest =>
  z
    .object({
      algorithm: zodAlgorithm,
      encoding: zodEncoding.optional(),
      hash: z.string().min(1),
    })
    .parse({
      algorithm: regexValue(/algorithm="(?<value>[^"]+)"/g, digest),
      encoding: regexValue(/encoding="(?<value>[^"]+)"/g, digest),
      hash: regexValue(/hash="(?<value>[^"]+)"/g, digest),
    });

const decodeSignatureHeader = (signature: string): DecodedSignature =>
  z
    .object({
      dsa: zodDsa.optional(),
      encoding: zodEncoding.optional(),
      hash: z.string().min(1),
      headers: z.array(z.string()).min(1),
      key: z.string().min(1),
      raw: z.coerce.boolean().optional(),
    })
    .parse({
      dsa: regexValue(/dsa="(?<value>[^"]+)"/g, signature),
      encoding: regexValue(/encoding="(?<value>[^"]+)"/g, signature),
      hash: regexValue(/hash="(?<value>[^"]+)"/g, signature),
      headers: (regexValue(/headers="(?<value>[^"]+)"/g, signature) || "")
        .split(",")
        .filter((header) => header.length > 0),
      key: regexValue(/key="(?<value>[^"]+)"/g, signature),
    });

const verifyDigest = <C extends PylonHttpContext = PylonHttpContext>(
  ctx: C,
  decoded: DecodedDigest,
): void =>
  new ShaKit({ algorithm: decoded.algorithm, encoding: decoded.encoding }).assert(
    JSON.stringify(snakeKeys(ctx.request.body)),
    decoded.hash,
  );

const verifySignature = <C extends PylonHttpContext = PylonHttpContext>(
  ctx: C,
  kryptos: IKryptos,
  decoded: DecodedSignature,
): void => {
  if (!Predicated.match(kryptos, SIGNED_REQUEST_VERIFY_FLOOR)) {
    throw new ClientError("Signed request names a key that cannot verify it", {
      status: ClientError.Status.Unauthorized,
      code: "invalid_signed_request_key",
      type: "urn:lindorm:pylon:error:invalid_signed_request_key",
      title: "Invalid Signed Request Key",
      details:
        "The key the request's Signature header names is not a usable verification key (wrong use, or not yet valid), so the request cannot be authenticated.",
      data: { kid: kryptos.id },
    });
  }

  const values: Dict = {};

  for (const header of decoded.headers) {
    values[header] = ctx.get(header);
  }

  new SignatureKit({
    kryptos,
    encoding: decoded.encoding,
    dsa: decoded.dsa,
  }).assert(JSON.stringify(values), decoded.hash);
};

export const createHttpSignedRequestMiddleware = <
  C extends PylonHttpContext = PylonHttpContext,
>(
  callback: GetSignedRequestKryptosCallback<C>,
  options: Options = {},
): PylonHttpMiddleware<C> =>
  async function httpSignedRequestMiddleware(ctx, next) {
    const signature = ctx.get("signature");

    if (!signature && options.required) {
      throw new ClientError("Signature is required", {
        status: ClientError.Status.Unauthorized,
        code: "signature_required",
        type: "urn:lindorm:pylon:error:signature_required",
        title: "Signature Required",
        details: "This endpoint requires a signed request with a Signature header",
      });
    }

    if (signature) {
      ctx.logger.debug("Signature header found", { signature });

      if (!ctx.get("date")) {
        throw new ClientError("Date header not found", {
          status: ClientError.Status.BadRequest,
          code: "missing_date_header",
          type: "urn:lindorm:pylon:error:missing_date_header",
          title: "Missing Date Header",
          details: "A signed request must include a Date header",
        });
      }

      const digest = ctx.get("digest");

      if (!digest) {
        throw new ClientError("Digest header not found", {
          status: ClientError.Status.BadRequest,
          code: "missing_digest_header",
          type: "urn:lindorm:pylon:error:missing_digest_header",
          title: "Missing Digest Header",
          details: "A signed request must include a Digest header",
        });
      }

      ctx.logger.debug("Digest header found", { digest });

      const decodedDigest = decodeDigestHeader(digest);
      const decodedSignature = decodeSignatureHeader(signature);

      const kryptos = await callback(ctx, decodedSignature.key);

      verifyDigest(ctx, decodedDigest);
      verifySignature(ctx, kryptos, decodedSignature);

      ctx.logger.debug("Signed request verified");
    }

    await next();
  };
