import type { IProteusRepository } from "@lindorm/proteus";
import { RateLimitSliding } from "../../../entities/index.js";
import type { RateLimitResult } from "./fixed-window-strategy.js";

export const slidingWindowStrategy = async (
  repository: IProteusRepository<RateLimitSliding>,
  key: string,
  windowMs: number,
  max: number,
): Promise<RateLimitResult> => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const expiresAt = new Date(now.getTime() + windowMs * 2);

  const entity = await repository.findOneOrSave(
    { id: key },
    { id: key, timestamps: [], expiresAt },
  );

  const validTimestamps = entity.timestamps.filter(
    (t) => t.getTime() > windowStart.getTime(),
  );

  if (validTimestamps.length >= max) {
    entity.timestamps = validTimestamps;
    entity.expiresAt = expiresAt;
    await repository.update(entity);

    const oldestInWindow = validTimestamps[0];
    const resetAt = new Date(oldestInWindow.getTime() + windowMs);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  validTimestamps.push(now);
  entity.timestamps = validTimestamps;
  entity.expiresAt = expiresAt;
  await repository.update(entity);

  const resetAt =
    validTimestamps.length > 0
      ? new Date(validTimestamps[0].getTime() + windowMs)
      : new Date(now.getTime() + windowMs);

  return {
    allowed: true,
    remaining: max - validTimestamps.length,
    resetAt,
  };
};
