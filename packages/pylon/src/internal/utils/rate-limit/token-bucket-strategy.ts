import { IProteusRepository } from "@lindorm/proteus";
import { RateLimitBucket } from "../../../entities";
import { RateLimitResult } from "./fixed-window-strategy";

export const tokenBucketStrategy = async (
  repository: IProteusRepository<RateLimitBucket>,
  key: string,
  windowMs: number,
  max: number,
): Promise<RateLimitResult> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs * 2);

  const entity = await repository.findOneOrSave(
    { id: key },
    { id: key, tokens: max, lastRefill: now, expiresAt },
  );

  const elapsed = now.getTime() - entity.lastRefill.getTime();
  const refillRate = max / windowMs;
  const tokensToAdd = Math.floor(refillRate * elapsed);
  const currentTokens = Math.min(max, entity.tokens + tokensToAdd);

  const msPerToken = windowMs / max;
  const resetAt =
    currentTokens > 0
      ? new Date(now.getTime() + windowMs)
      : new Date(entity.lastRefill.getTime() + msPerToken * (max - entity.tokens + 1));

  if (currentTokens <= 0) {
    entity.tokens = 0;
    entity.lastRefill = now;
    entity.expiresAt = expiresAt;
    await repository.update(entity);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  entity.tokens = currentTokens - 1;
  entity.lastRefill = now;
  entity.expiresAt = expiresAt;
  await repository.update(entity);

  return {
    allowed: true,
    remaining: entity.tokens,
    resetAt: new Date(now.getTime() + windowMs),
  };
};
