export const dedupPromise = <T>(fn: () => Promise<T>): (() => Promise<T>) => {
  let inFlight: Promise<T> | undefined;

  return () => {
    if (inFlight) return inFlight;

    const promise = fn().finally(() => {
      if (inFlight === promise) {
        inFlight = undefined;
      }
    });

    inFlight = promise;
    return promise;
  };
};
