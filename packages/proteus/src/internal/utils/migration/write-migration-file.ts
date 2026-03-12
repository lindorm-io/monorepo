import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";

export const writeMigrationFile = async (
  directory: string,
  filename: string,
  content: string,
): Promise<string> => {
  const filepath = join(directory, filename);
  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, content, "utf-8");
  return filepath;
};
