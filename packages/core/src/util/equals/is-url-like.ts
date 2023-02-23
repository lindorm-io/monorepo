export const isUrlLike = (input: any, base?: any): boolean => {
  if (input instanceof URL) return true;

  try {
    new URL(input, base).toString();
  } catch (_) {
    return false;
  }

  return true;
};
