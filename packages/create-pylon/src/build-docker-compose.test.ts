import { buildDockerCompose } from "./build-docker-compose.js";
import type { Answers } from "./types.js";
import { describe, expect, test } from "vitest";

const baseAnswers = (overrides: Partial<Answers> = {}): Answers => ({
  projectName: "test-app",
  projectDir: "",
  issuer: "http://localhost:3000",
  features: {
    http: true,
    socket: false,
    webhooks: false,
    audit: false,
    auth: false,
    rateLimit: false,
  },
  db: "none",
  kv: "none",
  bus: "none",
  workers: [],
  ...overrides,
});

describe("buildDockerCompose", () => {
  test("returns null when no service needs a container", () => {
    expect(buildDockerCompose(baseAnswers())).toBeNull();
    expect(buildDockerCompose(baseAnswers({ db: "sqlite" }))).toBeNull();
    expect(buildDockerCompose(baseAnswers({ db: "memory", kv: "memory" }))).toBeNull();
  });

  test("gives postgres a named volume + a top-level volumes block (so -k persists it)", () => {
    const yml = buildDockerCompose(baseAnswers({ db: "postgres" }))!;
    // postgres:18 mounts the parent dir, not /…/data (version-subdir convention).
    expect(yml).toContain("- postgres_data:/var/lib/postgresql\n");
    expect(yml).not.toContain("- postgres_data:/var/lib/postgresql/data");
    // Named volume must be declared top-level, else the mount is anonymous.
    expect(yml).toMatch(/\nvolumes:\n {2}postgres_data:\n/);
    expect(yml).toMatchSnapshot();
  });

  test("declares a named volume for every stateful service in the stack", () => {
    const yml = buildDockerCompose(
      baseAnswers({ db: "postgres", kv: "redis", bus: "rabbit" }),
    )!;
    expect(yml).toContain("- postgres_data:/var/lib/postgresql\n");
    expect(yml).toContain("- redis_data:/data");
    expect(yml).toContain("- rabbit_data:/var/lib/rabbitmq");
    // All three declared once at the top level.
    const declared = yml.slice(yml.indexOf("\nvolumes:\n"));
    expect(declared).toContain("  postgres_data:");
    expect(declared).toContain("  redis_data:");
    expect(declared).toContain("  rabbit_data:");
    expect(yml).toMatchSnapshot();
  });

  test("does not duplicate a shared driver's volume (redis as both kv and bus)", () => {
    const yml = buildDockerCompose(baseAnswers({ kv: "redis", bus: "redis" }))!;
    // redis appears once as a service and once as a declared volume.
    expect(yml.match(/redis_data:/g)?.length).toBe(2); // one mount + one declaration
    expect(yml.match(/^ {2}redis:$/gm)?.length).toBe(1);
  });

  test("nats has no volume (no persistence by default)", () => {
    const yml = buildDockerCompose(baseAnswers({ bus: "nats" }))!;
    expect(yml).toContain("nats:");
    expect(yml).not.toContain("volumes:");
  });
});
