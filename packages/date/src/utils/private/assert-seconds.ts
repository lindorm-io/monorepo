export const _assertSeconds = (number: number): void => {
  if (number < 9999999999) return;

  throw new Error("Invalid expiry: Expiry is not in seconds");
};
