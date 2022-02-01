import { InvalidToken, InvalidTokenOptions } from "../../entity";

export const getTestInvalidToken = (options: Partial<InvalidTokenOptions> = {}): InvalidToken =>
  new InvalidToken({
    ...options,
  });
