import { checkbox, confirm, select } from "@inquirer/prompts";
import { isHttpUrl } from "@lindorm/is";
import { existsSync, readdirSync, rmSync } from "fs";
import { resolve } from "path";
import { isValidProjectName, parseProjectName } from "./project-name.js";
import { promptTrimmedInput } from "./prompt-trimmed-input.js";
import type {
  Answers,
  DbDriver,
  Features,
  IrisDriver,
  KvDriver,
  WorkerKey,
} from "./types.js";

type RunPromptsInput = {
  positionalName?: string;
  cwd?: string;
};

const NAME_HINT =
  "Use a plain name (my-app) or an npm scope (@acme/my-app); lowercase, no spaces";

const promptProjectName = async (initial?: string): Promise<string> => {
  // Normalise the positional argument once, for the same reason the prompt
  // normalises its answer: the name that is validated has to be the name that
  // becomes the package.json `name` and the target directory.
  const positional = initial?.trim() ?? "";

  if (positional.length > 0) {
    if (!isValidProjectName(positional)) {
      throw new Error(`Invalid project name "${positional}". ${NAME_HINT}.`);
    }
    return positional;
  }

  return promptTrimmedInput({
    message: "Project name (plain or @scope/name):",
    default: "my-app",
    validate: (value) => (isValidProjectName(value) ? true : NAME_HINT),
  });
};

// The generated pylon serves its own JWKS at `{issuer}/.well-known/jwks.json`, so
// the issuer has to be something a location can be DERIVED from. Amphora would
// take a URN as an identity, but it derives no jwksUri from one — the scaffold
// would publish nothing. That is exactly what `isHttpUrl` asks, so ask it rather
// than re-deriving the rule here: a hand-rolled `/^https?:\/\/.+/` let
// `http://#x` through, which carries no authority.
const promptIssuer = async (): Promise<string> =>
  promptTrimmedInput({
    message:
      "Issuer URL (this service's identity — becomes the Amphora issuer for JWKS):",
    default: "http://localhost:3000",
    validate: (value) =>
      isHttpUrl(value)
        ? true
        : "Enter a fully-qualified URL with a host, e.g. https://auth.example.com",
  });

const promptFeatures = async (): Promise<Pick<Features, "http" | "socket">> => {
  const selected = await checkbox<"http" | "socket">({
    message: "Select features:",
    choices: [
      { name: "HTTP routes", value: "http", checked: true },
      { name: "Socket.IO listeners", value: "socket" },
    ],
  });

  return {
    http: selected.includes("http"),
    socket: selected.includes("socket"),
  };
};

const promptDb = async (): Promise<DbDriver> =>
  select<DbDriver>({
    message: "Persistence store (Proteus DB source):",
    default: "none",
    choices: [
      { name: "postgres", value: "postgres" },
      { name: "mysql", value: "mysql" },
      { name: "mongo", value: "mongo" },
      { name: "sqlite", value: "sqlite" },
      { name: "none", value: "none" },
    ],
  });

const promptKv = async (): Promise<KvDriver> =>
  select<KvDriver>({
    message: "Key-value store (Proteus KV source — rate-limit / session / cache):",
    default: "none",
    choices: [
      { name: "redis", value: "redis" },
      { name: "memory", value: "memory" },
      { name: "none", value: "none" },
    ],
  });

const promptIrisDriver = async (): Promise<IrisDriver> =>
  select<IrisDriver>({
    message: "Message bus driver (Iris):",
    default: "none",
    choices: [
      { name: "kafka", value: "kafka" },
      { name: "nats", value: "nats" },
      { name: "rabbit", value: "rabbit" },
      { name: "redis", value: "redis" },
      { name: "none", value: "none" },
    ],
  });

const promptWebhooks = async (): Promise<boolean> =>
  confirm({ message: "Webhooks?", default: false });

const promptAudit = async (): Promise<boolean> =>
  confirm({ message: "Audit logging?", default: false });

const promptAuth = async (): Promise<boolean> =>
  confirm({ message: "OIDC authentication?", default: false });

const promptRateLimit = async (): Promise<boolean> =>
  confirm({ message: "Rate limiting?", default: false });

const promptWorkers = async (): Promise<Array<WorkerKey>> => {
  const choices: Array<{ name: string; value: WorkerKey; checked?: boolean }> = [
    { name: "Amphora entity sync", value: "amphora-entity-sync" },
    { name: "Certificate expiry monitor", value: "certificate-expiry" },
    { name: "Expiry cleanup", value: "expiry-cleanup" },
    { name: "Kryptos key rotation", value: "kryptos-rotation" },
  ];

  return checkbox<WorkerKey>({ message: "Workers:", choices });
};

const isNonEmptyDirectory = (dir: string): boolean => {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).length > 0;
  } catch {
    return false;
  }
};

export const resolveExistingCollision = async (projectDir: string): Promise<void> => {
  if (!isNonEmptyDirectory(projectDir)) return;

  const action = await select<"remove" | "cancel">({
    message: `Target directory ${projectDir} is not empty. Remove it and continue?`,
    default: "cancel",
    choices: [
      { name: "Remove and continue", value: "remove" },
      { name: "Cancel", value: "cancel" },
    ],
  });

  if (action === "cancel") {
    throw new Error("Operation cancelled by user");
  }

  rmSync(projectDir, { recursive: true, force: true });
};

export const runPrompts = async ({
  positionalName,
  cwd = process.cwd(),
}: RunPromptsInput): Promise<Answers> => {
  const projectName = await promptProjectName(positionalName);
  // For a scoped name (@acme/app) the package.json keeps the full name but the
  // directory is the unscoped basename, so scoped monorepos need no rename.
  const { dirName } = parseProjectName(projectName);
  const projectDir = resolve(cwd, dirName);

  await resolveExistingCollision(projectDir);

  const issuer = await promptIssuer();
  const featureFlags = await promptFeatures();
  const db = await promptDb();
  const kv = await promptKv();
  const bus = await promptIrisDriver();

  const hasProteus = db !== "none" || kv !== "none";
  const hasIris = bus !== "none";
  const bothSelected = hasProteus && hasIris;
  const webhooks = bothSelected ? await promptWebhooks() : false;
  const audit = bothSelected ? await promptAudit() : false;

  const auth = await promptAuth();
  const session = auth;
  const canRateLimit = kv !== "none";
  const rateLimit = canRateLimit ? await promptRateLimit() : false;

  const workers = hasProteus ? await promptWorkers() : [];

  return {
    projectName,
    projectDir,
    issuer,
    features: {
      http: featureFlags.http,
      socket: featureFlags.socket,
      webhooks,
      audit,
      session,
      auth,
      rateLimit,
    },
    db,
    kv,
    bus,
    workers,
  };
};
