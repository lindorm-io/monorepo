export const safelyParse = <T = any>(value: string): T => {
  try {
    return JSON.parse(value);
  } catch {
    return value as T;
  }
};
