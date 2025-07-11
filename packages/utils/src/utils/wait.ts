import { sleep } from "./sleep";

export const wait = async (
  callback: () => boolean,
  timeout: number = 10000,
  interval: number = 50,
): Promise<void> => {
  const start = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (callback()) return;
    if (Date.now() - start > timeout) throw new Error("Timeout waiting for condition");
    await sleep(interval);
  }
};
