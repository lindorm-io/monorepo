import { randomString } from "@lindorm-io/random";
import { HEADER_SIZE, HEADER_SYMBOL, OCT_SECRET_SYMBOLS } from "../../constants";
import { OctKeySize } from "../../types";

export const generateOctSecret = (size: OctKeySize = 32): string => {
  const secret = randomString(size, {
    custom: { symbols: OCT_SECRET_SYMBOLS },
  });

  const split = secret.split("");
  const indices: Array<number> = [];

  while (indices.length < HEADER_SIZE) {
    const index = Math.floor(Math.random() * size);
    if (indices.includes(index)) continue;
    indices.push(index);
  }

  for (let i = 0; i < HEADER_SIZE; i++) {
    split[indices[i]] = HEADER_SYMBOL;
  }

  return split.join("");
};
