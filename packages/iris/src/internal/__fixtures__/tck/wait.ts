export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number = 10000,
  pollMs: number = 50,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate()) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollMs));
  }

  if (!(await predicate())) {
    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
  }
};
