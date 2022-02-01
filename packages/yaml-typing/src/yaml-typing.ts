import { getTyping } from "./get-typing";
import { readYamlFiles } from "./read-yaml-files";
import { writeLinesToFile } from "./write-lines-to-file";

export interface YamlTypingOptions {
  extensions: Array<string>;
  read: string;
  requireAll: boolean;
  root: string;
  write: string;
}

export const yamlTyping = async (
  fileName: string,
  options: Partial<YamlTypingOptions> = {},
): Promise<void> => {
  const { read = "" } = options;

  const samples = readYamlFiles(read, options);
  const { lines } = await getTyping(fileName, samples);

  await writeLinesToFile(fileName, lines, options);
};
