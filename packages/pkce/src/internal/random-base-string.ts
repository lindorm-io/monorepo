import { randomString } from "@lindorm/random";

export const randomBaseString = (length: number): string =>
  randomString(length, "base64url");
