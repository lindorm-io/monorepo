/**
 * Vite module ids may carry a query suffix (`?v=<hash>` cache-busting,
 * `?import`); the file-extension check and the emitted uri must both see the
 * bare path.
 */
export const cleanId = (id: string): string => {
  const index = id.indexOf("?");

  if (index === -1) {
    return id;
  }

  return id.slice(0, index);
};
