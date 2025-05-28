import { SignatureKit } from "@lindorm/aegis";
import { ClientError } from "@lindorm/errors";
import { IKryptos } from "@lindorm/kryptos";
import { ShaKit } from "@lindorm/sha";
import { Dict, DsaEncoding, ShaAlgorithm } from "@lindorm/types";
import { BinaryToTextEncoding } from "crypto";
import z from "zod";
import { PylonHttpContext, PylonHttpMiddleware } from "../../types";

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
    JSON.stringify(ctx.request.body),
    decoded.hash,
  );

const verifySignature = <C extends PylonHttpContext = PylonHttpContext>(
  ctx: C,
  kryptos: IKryptos,
  decoded: DecodedSignature,
): void => {
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
      throw new ClientError("Signature is required");
    }

    if (signature) {
      ctx.logger.debug("Signature header found", { signature });

      if (!ctx.get("date")) {
        throw new ClientError("Date header not found");
      }

      const digest = ctx.get("digest");

      if (!digest) {
        throw new ClientError("Digest header not found");
      }

      ctx.logger.debug("Digest header found", { digest });

      const decodedDigest = decodeDigestHeader(digest);
      const decodedSignature = decodeSignatureHeader(signature);

      const kryptos = await callback(ctx, decodedSignature.key);

      verifyDigest(ctx, decodedDigest);
      verifySignature(ctx, kryptos, decodedSignature);

      ctx.logger.info("Signed request verified");
    }

    await next();
  };
