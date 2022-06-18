import { InvalidToken, InvalidTokenOptions } from "../../entity";

export const createTestInvalidToken = (options: Partial<InvalidTokenOptions> = {}): InvalidToken =>
  new InvalidToken({
    expires: new Date("2023-01-01T08:00:00.000Z"),
    ...options,
  });
