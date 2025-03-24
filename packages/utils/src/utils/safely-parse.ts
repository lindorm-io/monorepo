export const safelyParse = <T = any>(value: string): T => {
  try {
    return JSON.parse(value);
  } catch (_) {
    return value as T;
  }
};
