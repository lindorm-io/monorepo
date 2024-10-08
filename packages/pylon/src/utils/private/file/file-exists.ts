import { access } from "fs/promises";

export const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch (_) {
    return false;
  }
};
