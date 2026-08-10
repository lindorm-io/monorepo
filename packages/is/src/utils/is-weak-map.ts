export const isWeakMap = (input: any): input is WeakMap<WeakKey, any> =>
  Boolean(input) && input instanceof WeakMap;
