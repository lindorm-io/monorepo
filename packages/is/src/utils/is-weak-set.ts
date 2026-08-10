export const isWeakSet = (input: any): input is WeakSet<WeakKey> =>
  Boolean(input) && input instanceof WeakSet;
