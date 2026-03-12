const maximum = (length: number): number => parseInt("".padEnd(length, "9"), 10);

export const randomNumber = (length: number): number => {
  const max = BigInt(maximum(length)) + 1n;
  const limit = (2n ** 64n / max) * max;
  const arr = new BigUint64Array(1);
  do {
    globalThis.crypto.getRandomValues(arr);
  } while (arr[0] >= limit);
  return Number(arr[0] % max);
};
