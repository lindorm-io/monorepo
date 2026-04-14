import { access, mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import { KryptosKit } from "@lindorm/kryptos";
import { Logger } from "@lindorm/logger";

type InitOptions = {
  directory?: string;
  dryRun?: boolean;
  force?: boolean;
};

type InitAnswers = {
  routes: boolean;
  listeners: boolean;
  session: boolean;
  auth: boolean;
  webhooks: boolean;
  queue: boolean;
  rateLimit: boolean;
};

const loggerTemplate = (): string =>
  [
    `import { Logger } from "@lindorm/logger";`,
    ``,
    `export const logger = new Logger();`,
    ``,
  ].join("\n");

const configTemplate = (answers: InitAnswers): string => {
  const lines = [
    `import { configuration } from "@lindorm/config";`,
    `import type { Environment } from "@lindorm/types";`,
    `import { z } from "zod";`,
    ``,
    `export const config = configuration({`,
    `  port: z.number().default(3000),`,
    `  environment: z.enum(["production", "staging", "development", "test"]).default("development"),`,
    `  kryptosKek: z.array(z.string()).min(1),`,
  ];

  if (answers.auth) {
    lines.push(`  oidcIssuer: z.string(),`);
    lines.push(`  oidcClientId: z.string(),`);
    lines.push(`  oidcClientSecret: z.string(),`);
  }

  lines.push(`});`);
  lines.push(``);

  return lines.join("\n");
};

const amphoraTemplate = (): string =>
  [
    `import { Amphora } from "@lindorm/amphora";`,
    `import { KryptosKit } from "@lindorm/kryptos";`,
    `import { config } from "./config";`,
    `import { logger } from "../logger";`,
    ``,
    `export const amphora = new Amphora({ logger });`,
    ``,
    `for (const envString of config.kryptosKek) {`,
    `  amphora.add(KryptosKit.env.import(envString));`,
    `}`,
    ``,
  ].join("\n");

const envTemplate = (kekEnvString: string): string =>
  [
    `# ---------------------------------------------------------------`,
    `# PYLON_KRYPTOS_KEK`,
    `#`,
    `# Key Encryption Keys (KEKs) that envelope-encrypt all private`,
    `# keys stored in the database. Pylon will refuse to boot without`,
    `# at least one KEK, because the Kryptos entity has an @Encrypted`,
    `# field.`,
    `#`,
    `# Format: JSON array of kryptos env strings. Parsed by`,
    `# @lindorm/config via its zod array support.`,
    `#`,
    `# Rotation: to rotate, PREPEND a new kryptos to the array. Pylon`,
    `# picks the newest active key for new writes (by createdAt), and`,
    `# old rows still decrypt via the kid embedded in the AES`,
    `# ciphertext header. Remove an old KEK only once no rows remain`,
    `# encrypted under it.`,
    `#`,
    `# NEVER commit this value. Rotate from a secret manager in`,
    `# production.`,
    `# ---------------------------------------------------------------`,
    `PYLON_KRYPTOS_KEK='${JSON.stringify([kekEnvString])}'`,
    ``,
  ].join("\n");

const pylonTemplate = (answers: InitAnswers): string => {
  const lines = [
    `import { join } from "path";`,
    `import { Pylon } from "@lindorm/pylon";`,
    `import { amphora } from "./amphora";`,
    `import { config } from "./config";`,
    `import { logger } from "../logger";`,
    ``,
    `export const pylon = new Pylon({`,
    `  port: config.port,`,
    `  environment: config.environment,`,
    `  logger,`,
    `  amphora,`,
  ];

  if (answers.routes) {
    lines.push(`  routes: join(__dirname, "..", "routes"),`);
  }

  if (answers.listeners) {
    lines.push(`  socket: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    listeners: join(__dirname, "..", "listeners"),`);
    lines.push(`  },`);
  }

  if (answers.session) {
    lines.push(`  session: {`);
    lines.push(`    enabled: true,`);
    lines.push(`  },`);
  }

  if (answers.auth) {
    lines.push(`  auth: {`);
    lines.push(`    issuer: config.oidcIssuer,`);
    lines.push(`    clientId: config.oidcClientId,`);
    lines.push(`    clientSecret: config.oidcClientSecret,`);
    lines.push(`  },`);
  }

  if (answers.webhooks) {
    lines.push(`  webhook: {`);
    lines.push(`    enabled: true,`);
    lines.push(`  },`);
  }

  if (answers.queue) {
    lines.push(`  queue: {`);
    lines.push(`    enabled: true,`);
    lines.push(`  },`);
  }

  if (answers.rateLimit) {
    lines.push(`  rateLimit: {`);
    lines.push(`    enabled: true,`);
    lines.push(`    window: "1m",`);
    lines.push(`    max: 100,`);
    lines.push(`  },`);
  }

  lines.push(`});`);
  lines.push(``);

  return lines.join("\n");
};

const indexTemplate = (): string =>
  [`import { pylon } from "./pylon/pylon";`, ``, `pylon.start();`, ``].join("\n");

const helloRouteTemplate = (): string =>
  [
    `import { useHandler } from "@lindorm/pylon";`,
    `import type { ServerHttpMiddleware } from "../types/context";`,
    ``,
    `export const GET: Array<ServerHttpMiddleware> = [`,
    `  useHandler(async () => {`,
    `    return { body: { message: "General Kenobi" } };`,
    `  }),`,
    `];`,
    ``,
  ].join("\n");

const routeMiddlewareTemplate = (): string =>
  [
    `import type { ServerHttpMiddleware } from "../types/context";`,
    ``,
    `const middleware: ServerHttpMiddleware = async (ctx, next) => {`,
    `  // TODO: add global route middleware`,
    `  await next();`,
    `};`,
    ``,
    `export const MIDDLEWARE: Array<ServerHttpMiddleware> = [middleware];`,
    ``,
  ].join("\n");

const listenerMiddlewareTemplate = (): string =>
  [
    `import type { ServerSocketMiddleware } from "../types/context";`,
    ``,
    `const middleware: ServerSocketMiddleware = async (ctx, next) => {`,
    `  // TODO: add global listener middleware`,
    `  await next();`,
    `};`,
    ``,
    `export const MIDDLEWARE: Array<ServerSocketMiddleware> = [middleware];`,
    ``,
  ].join("\n");

const contextTypesTemplate = (): string =>
  [
    `import type {`,
    `  PylonHandler,`,
    `  PylonHttpContext,`,
    `  PylonHttpMiddleware,`,
    `  PylonSocketContext,`,
    `  PylonSocketMiddleware,`,
    `} from "@lindorm/pylon";`,
    `import type { z } from "zod";`,
    ``,
    `export type ServerHttpContext = PylonHttpContext & {};`,
    `export type ServerHttpMiddleware = PylonHttpMiddleware<ServerHttpContext>;`,
    ``,
    `export type ServerSocketContext = PylonSocketContext & {};`,
    `export type ServerSocketMiddleware = PylonSocketMiddleware<ServerSocketContext>;`,
    ``,
    `export type ServerHandler<`,
    `  Schema extends z.ZodType = z.ZodAny,`,
    `> = PylonHandler<ServerHttpContext & { data: z.infer<Schema> }>;`,
    ``,
  ].join("\n");

const nodeConfigTemplate = (): string =>
  [`{`, `  "port": 3000,`, `  "environment": "development"`, `}`, ``].join("\n");

export const init = async (options: InitOptions): Promise<void> => {
  const { confirm } = await import("@inquirer/prompts");

  const answers: InitAnswers = {
    routes: await confirm({ message: "HTTP routes?", default: true }),
    listeners: await confirm({ message: "Socket.IO listeners?", default: false }),
    session: await confirm({ message: "Session support?", default: false }),
    auth: await confirm({ message: "Auth/OIDC?", default: false }),
    webhooks: await confirm({ message: "Webhooks?", default: false }),
    queue: await confirm({ message: "Job queue?", default: false }),
    rateLimit: await confirm({ message: "Rate limiting?", default: false }),
  };

  const directory = resolve(process.cwd(), options.directory ?? ".");

  const kek = KryptosKit.generate.auto({
    algorithm: "dir",
    encryption: "A256GCM",
    purpose: "kryptos-kek",
  });

  const envPath = join(directory, ".env");
  let writeEnv = true;

  try {
    await access(envPath);
    if (!options.force) {
      writeEnv = false;
      Logger.std.warn(
        `.env already exists at ${envPath}; skipping (pass --force to overwrite).`,
      );
    }
  } catch {
    // .env does not exist yet — will be written fresh
  }

  const files: Array<{ path: string; content: string }> = [
    {
      path: join(directory, "config", ".node_config.json"),
      content: nodeConfigTemplate(),
    },
    { path: join(directory, "src", "logger", "index.ts"), content: loggerTemplate() },
    { path: join(directory, "src", "pylon", "amphora.ts"), content: amphoraTemplate() },
    {
      path: join(directory, "src", "pylon", "config.ts"),
      content: configTemplate(answers),
    },
    {
      path: join(directory, "src", "pylon", "pylon.ts"),
      content: pylonTemplate(answers),
    },
    { path: join(directory, "src", "index.ts"), content: indexTemplate() },
    {
      path: join(directory, "src", "types", "context.ts"),
      content: contextTypesTemplate(),
    },
    { path: join(directory, "src", "handlers", ".gitkeep"), content: "" },
    { path: join(directory, "src", "middleware", ".gitkeep"), content: "" },
    { path: join(directory, "src", "workers", ".gitkeep"), content: "" },
  ];

  if (writeEnv) {
    files.unshift({
      path: envPath,
      content: envTemplate(kek.toEnvString()),
    });
  }

  if (answers.routes) {
    files.push({
      path: join(directory, "src", "routes", "_middleware.ts"),
      content: routeMiddlewareTemplate(),
    });
    files.push({
      path: join(directory, "src", "routes", "hello-there.ts"),
      content: helloRouteTemplate(),
    });
  }

  if (answers.listeners) {
    files.push({
      path: join(directory, "src", "listeners", "_middleware.ts"),
      content: listenerMiddlewareTemplate(),
    });
  }

  if (options.dryRun) {
    Logger.std.log("\nDry run — files that would be created:\n");

    for (const file of files) {
      Logger.std.log(`  ${file.path}`);
    }

    return;
  }

  for (const file of files) {
    const dir = file.path.endsWith(".gitkeep")
      ? file.path.replace("/.gitkeep", "")
      : undefined;

    if (dir) {
      await mkdir(dir, { recursive: true });
    }

    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, file.content, "utf-8");
  }

  Logger.std.info("Initialized Pylon project:");

  for (const file of files) {
    if (!file.path.endsWith(".gitkeep")) {
      Logger.std.log(`  ${file.path}`);
    }
  }
};
