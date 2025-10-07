export const safelyParse = <T = any>(value: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
};
