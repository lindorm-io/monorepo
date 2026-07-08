import { join } from "path";

export const resolveRouteFile = (
  urlPath: string,
  directory: string,
): { filepath: string; depth: number } => {
  const filePath = urlPath
    .replace(/^\//, "")
    .replace(/:([a-zA-Z]+)/g, "[$1]")
    .replace(/\*([a-zA-Z]+)/g, "[...$1]");
  const segments = filePath.split("/");
  const lastSegment = segments.pop()!;
  const filename = lastSegment === "" ? "index.ts" : `${lastSegment}.ts`;
  const filepath = join(directory, ...segments, filename);
  const depth = segments.length + 1; // +1 for the routes/ dir itself
  return { filepath, depth };
};
