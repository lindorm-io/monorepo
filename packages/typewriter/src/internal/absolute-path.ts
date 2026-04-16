import { isString } from "@lindorm/is";
import { join } from "path";

export const absolutePath = (path: string): string => {
  if (!isString(path)) {
    throw new Error("No input path provided");
  }

  if (path === ".") return process.cwd();

  if (path === "~") return process.env.HOME || "";

  if (path.startsWith("/")) return path;

  if (path.startsWith("~")) return join(process.env.HOME || "", path.slice(1));

  return join(process.cwd(), path);
};
