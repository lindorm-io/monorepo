export const isSet = <T = any>(input: any): input is Set<T> =>
  Boolean(input) && input instanceof Set;
