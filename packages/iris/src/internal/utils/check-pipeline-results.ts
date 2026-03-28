export const checkPipelineResults = (
  results: Array<[Error | null, unknown]> | null,
): void => {
  if (!results) {
    throw new Error("Redis pipeline returned null results");
  }

  for (const [err] of results) {
    if (err) throw err;
  }
};
