import { existsSync } from "fs";
import { resolve } from "path";

export const resolveComposeFile = (file: string): string => {
  if (file) {
    const resolved = resolve(file);
    if (!existsSync(resolved)) {
      throw new Error(`Compose file not found: ${resolved}`);
    }
    return resolved;
  }

  const yml = resolve("docker-compose.yml");
  if (existsSync(yml)) return yml;

  const yaml = resolve("docker-compose.yaml");
  if (existsSync(yaml)) return yaml;

  throw new Error(
    `Compose file not found: looked for docker-compose.yml and docker-compose.yaml in
  ${process.cwd()}`,
  );
};
