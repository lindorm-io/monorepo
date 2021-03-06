export const isURL = (string: string): boolean => {
  try {
    new URL(string).toString();
  } catch (_) {
    return false;
  }
  return true;
};
