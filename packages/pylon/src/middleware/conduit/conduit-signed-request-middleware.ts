import { SignatureKit } from "@lindorm/aegis";
import { snakeKeys } from "@lindorm/case";
import { ConduitMiddleware } from "@lindorm/conduit";
import { IKryptos } from "@lindorm/kryptos";
import { ShaKit } from "@lindorm/sha";
import { DsaEncoding, ShaAlgorithm } from "@lindorm/types";
import { BinaryToTextEncoding } from "crypto";

type Options = {
  algorithm?: ShaAlgorithm;
  dsa?: DsaEncoding;
  encoding?: BinaryToTextEncoding;
  kryptos: IKryptos;
};

export const conduitSignedRequestMiddleware = (options: Options): ConduitMiddleware =>
  async function conduitSignedRequestMiddleware(ctx, next) {
    const { algorithm = "SHA256", dsa, encoding = "base64url", kryptos } = options;

    const shaKit = new ShaKit({ algorithm, encoding });
    const signatureKit = new SignatureKit({ dsa, encoding, kryptos });

    const bhash = shaKit.hash(JSON.stringify(snakeKeys(ctx.req.body)));

    ctx.req.headers.digest = [
      `algorithm="${algorithm}"`,
      `encoding="${encoding}"`,
      `hash="${bhash}"`,
    ].join("; ");

    const hhash = signatureKit.format(signatureKit.sign(JSON.stringify(ctx.req.headers)));

    ctx.req.headers.signature = [
      ...(dsa ? [`dsa="${dsa}"`] : []),
      `encoding="${encoding}"`,
      `headers="${Object.keys(ctx.req.headers).join(",")}"`,
      `key="${kryptos.id}"`,
      `hash="${hhash}"`,
    ].join("; ");

    await next();
  };
