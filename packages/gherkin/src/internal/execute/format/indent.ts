export const indent = (text: string, spaces: number): string =>
  text
    .split("\n")
    .map((line) => (line.length > 0 ? " ".repeat(spaces) + line : line))
    .join("\n");
