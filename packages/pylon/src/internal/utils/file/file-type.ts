import { basename, extname } from "path";

export const fileType = async (path: string, ext?: string): Promise<string> => {
  if (ext) return extname(basename(path, ext));
  return extname(path);
};
