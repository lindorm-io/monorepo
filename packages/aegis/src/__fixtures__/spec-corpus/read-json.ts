import { readFileSync } from "node:fs";

export const readJson = <T>(url: URL): T => JSON.parse(readFileSync(url, "utf8")) as T;
