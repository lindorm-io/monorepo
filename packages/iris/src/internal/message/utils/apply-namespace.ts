export const applyNamespace = (base: string, namespace: string | null): string =>
  namespace ? `${namespace}.${base}` : base;
