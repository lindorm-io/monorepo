import type { IProteusRepository } from "@lindorm/proteus";
import type { RateLimitFixed } from "../../../entities/RateLimitFixed.js";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export const fixedWindowStrategy = async (
  repository: IProteusRepository<RateLimitFixed>,
  key: string,
  windowMs: number,
  max: number,
): Promise<RateLimitResult> => {
  const now = new Date();
  const windowStart = new Date(now.getTime());
  const expiresAt = new Date(now.getTime() + windowMs * 2);

  const entity = await repository.findOneOrSave(
    { id: key },
    { id: key, count: 0, windowStart, expiresAt },
  );

  if (now.getTime() - entity.windowStart.getTime() >= windowMs) {
    entity.count = 1;
    entity.windowStart = now;
    entity.expiresAt = expiresAt;
    await repository.update(entity);

    return {
      allowed: true,
      remaining: max - 1,
      resetAt: new Date(now.getTime() + windowMs),
    };
  }

  await repository.increment({ id: key }, "count", 1);
  const newCount = entity.count + 1;

  const resetAt = new Date(entity.windowStart.getTime() + windowMs);

  return {
    allowed: newCount <= max,
    remaining: Math.max(0, max - newCount),
    resetAt,
  };
};
