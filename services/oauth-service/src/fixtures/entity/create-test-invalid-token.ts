import { InvalidToken, InvalidTokenOptions } from "../../entity";

export const createTestInvalidToken = (options: Partial<InvalidTokenOptions> = {}): InvalidToken =>
  new InvalidToken({
    ...options,
  });
