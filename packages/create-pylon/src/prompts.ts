import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { existsSync, readdirSync, rmSync } from "fs";
import { resolve } from "path";
import type { Answers, Features, IrisDriver, ProteusDriver, WorkerKey } from "./types";

type RunPromptsInput = {
  positionalName?: string;
  cwd?: string;
};

const promptProjectName = async (initial?: string): Promise<string> => {
  if (initial && initial.trim().length > 0) return initial.trim();

  return input({
    message: "Project name:",
    default: "my-app",
    validate: (value) => (value.trim().length > 0 ? true : "Name cannot be empty"),
  });
};

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

const promptProteusDriver = async (): Promise<ProteusDriver> =>
  select<ProteusDriver>({
    message: "Persistence driver (Proteus):",
    default: "none",
    choices: [
      { name: "none", value: "none" },
      { name: "memory", value: "memory" },
      { name: "mongo", value: "mongo" },
      { name: "mysql", value: "mysql" },
      { name: "postgres", value: "postgres" },
      { name: "redis", value: "redis" },
      { name: "sqlite", value: "sqlite" },
    ],
  });

const promptIrisDriver = async (): Promise<IrisDriver> =>
  select<IrisDriver>({
    message: "Message bus driver (Iris):",
    default: "none",
    choices: [
      { name: "none", value: "none" },
      { name: "kafka", value: "kafka" },
      { name: "nats", value: "nats" },
      { name: "rabbit", value: "rabbit" },
      { name: "redis", value: "redis" },
    ],
  });

const promptWebhooks = async (): Promise<boolean> =>
  confirm({ message: "Webhooks?", default: false });

const promptAudit = async (): Promise<boolean> =>
  confirm({ message: "Audit logging?", default: false });

const promptSession = async (): Promise<boolean> =>
  confirm({ message: "Sessions?", default: false });

const promptAuth = async (): Promise<boolean> =>
  confirm({ message: "OIDC authentication?", default: false });

const promptRateLimit = async (): Promise<boolean> =>
  confirm({ message: "Rate limiting?", default: false });

const promptWorkers = async (hasProteus: boolean): Promise<Array<WorkerKey>> => {
  const choices: Array<{ name: string; value: WorkerKey; checked?: boolean }> = [
    { name: "Amphora key refresh", value: "amphora-refresh", checked: true },
  ];

  if (hasProteus) {
    choices.push(
      { name: "Amphora entity sync", value: "amphora-entity-sync" },
      { name: "Expiry cleanup", value: "expiry-cleanup" },
      { name: "Kryptos key rotation", value: "kryptos-rotation" },
    );
  }

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
  const projectDir = resolve(cwd, projectName);

  await resolveExistingCollision(projectDir);

  const featureFlags = await promptFeatures();
  const proteusDriver = await promptProteusDriver();
  const irisDriver = await promptIrisDriver();

  const bothSelected = proteusDriver !== "none" && irisDriver !== "none";
  const webhooks = bothSelected ? await promptWebhooks() : false;
  const audit = bothSelected ? await promptAudit() : false;

  let session = await promptSession();
  const auth = await promptAuth();
  const rateLimit = proteusDriver !== "none" ? await promptRateLimit() : false;

  if (auth && !session) {
    session = true;
    process.stdout.write("Sessions auto-enabled (required by OIDC auth).\n");
  }

  const workers = await promptWorkers(proteusDriver !== "none");

  return {
    projectName,
    projectDir,
    features: {
      http: featureFlags.http,
      socket: featureFlags.socket,
      webhooks,
      audit,
      session,
      auth,
      rateLimit,
    },
    proteusDriver,
    irisDriver,
    workers,
  };
};
