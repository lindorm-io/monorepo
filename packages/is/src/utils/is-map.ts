export const isMap = <K = any, V = any>(input: any): input is Map<K, V> =>
  Boolean(input) && input instanceof Map;
