export type Multiplexable = { readonly multiplexed?: boolean };

/**
 * Run N independent async tasks against a query client. When the client is
 * pool-backed (multiplexed: true), run them in parallel via Promise.all —
 * each task acquires its own connection. When the client is a single
 * connection (transactional, sync), serialize them — pg@9 will throw on
 * concurrent client.query, and mysql2 silently queues out-of-order.
 */
export const fanout = async <T>(
  client: Multiplexable,
  fns: ReadonlyArray<() => Promise<T>>,
): Promise<Array<T>> => {
  if (client.multiplexed) {
    return Promise.all(fns.map((fn) => fn()));
  }
  const results: Array<T> = [];
  for (const fn of fns) {
    results.push(await fn());
  }
  return results;
};
