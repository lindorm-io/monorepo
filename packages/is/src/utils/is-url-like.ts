export const isUrlLike = (input: any, base?: any): input is URL | string => {
  if (!input) return false;

  if (input instanceof URL) return true;

  try {
    new URL(input, base).toString();
  } catch (_) {
    return false;
  }

  return true;
};
