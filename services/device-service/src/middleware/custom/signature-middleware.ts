import { Dict } from "@lindorm-io/common-types";
import { verifyRsaSignature, verifyShaHash } from "@lindorm-io/crypto";
import { ClientError } from "@lindorm-io/errors";
import { ServerKoaContext, ServerKoaMiddleware } from "../../types";
import { destructHeaderDigest, destructHeaderSignature } from "../../util";

const handleDigest = (ctx: ServerKoaContext, digest: string): void => {
  const { algorithm, format, hash } = destructHeaderDigest(digest);

  const verified = verifyShaHash({
    algorithm,
    data: JSON.stringify(ctx.request.body),
    format,
    hash,
  });

  ctx.logger.debug("Digest header verified", { digest, verified });

  if (verified) return;

  throw new ClientError("Invalid digest", {
    description: "Digest does not match expected values",
  });
};

const handleSignature = async (ctx: ServerKoaContext, signature: string): Promise<void> => {
  const {
    mongo: { publicKeyRepository },
  } = ctx;

  const { algorithm, format, hash, headers, key } = destructHeaderSignature(signature);

  const values: Dict = {};

  for (const header of headers) {
    values[header] = ctx.get(header);
  }

  ctx.entity.publicKey = await publicKeyRepository.find({ id: key });

  const verified = verifyRsaSignature({
    algorithm,
    data: JSON.stringify(values),
    format,
    key: ctx.entity.publicKey.key,
    signature: hash,
  });

  ctx.logger.debug("Signature header verified", { signature, verified });

  if (verified) return;

  throw new ClientError("Invalid signature", {
    description: "Signature does not match expected values",
  });
};

export const signatureMiddleware: ServerKoaMiddleware = async (ctx, next) => {
  const signature = ctx.get("signature");

  if (signature) {
    ctx.logger.info("Found signature header", { signature });

    if (!ctx.get("date")) {
      throw new ClientError("Date header missing on signed request");
    }

    const digest = ctx.get("digest");

    if (!digest) {
      throw new ClientError("Digest header missing on signed request");
    }

    handleDigest(ctx, digest);

    await handleSignature(ctx, signature);

    ctx.logger.info("Signature verified");
  }

  await next();
};
