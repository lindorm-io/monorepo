import { captureOutput } from "./capture-output.js";
import { inspectServices } from "./inspect-services.js";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

vi.mock("./capture-output.js");

const mockCaptureOutput = captureOutput as MockedFunction<typeof captureOutput>;

// Route the two docker probes by their args: `... config ...` returns the
// resolved compose JSON, `ps ...` returns the running-container port table.
const mockDocker = (config: unknown, ps: string, opts?: { configCode?: number }) => {
  mockCaptureOutput.mockImplementation(async (_command, args) => {
    if (args.includes("config")) {
      return { code: opts?.configCode ?? 0, stdout: JSON.stringify(config) };
    }
    return { code: 0, stdout: ps };
  });
};

const composeConfig = (ports: Record<string, Array<{ published: unknown }>>) => ({
  services: Object.fromEntries(
    Object.entries(ports).map(([name, p]) => [name, { ports: p }]),
  ),
});

describe("inspectServices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("status 'all' when every published port is bound by a running container", async () => {
    mockDocker(
      composeConfig({
        rabbitmq: [{ published: "5672" }],
        redis: [{ published: "6379" }],
      }),
      "root-rabbitmq-1\t0.0.0.0:5672->5672/tcp, :::5672->5672/tcp\n" +
        "root-redis-1\t0.0.0.0:6379->6379/tcp\n",
    );

    const result = await inspectServices({ file: "docker-compose.yml", project: "" });

    expect(result.status).toBe("all");
    expect(result.required.sort()).toEqual([5672, 6379]);
    expect(result.boundRequired.sort()).toEqual([5672, 6379]);
    expect(result.bound.get(5672)).toBe("root-rabbitmq-1");
  });

  test("status 'partial' when only some published ports are bound", async () => {
    mockDocker(
      composeConfig({
        rabbitmq: [{ published: "5672" }],
        redis: [{ published: "6379" }],
      }),
      "root-rabbitmq-1\t0.0.0.0:5672->5672/tcp\n",
    );

    const result = await inspectServices({ file: "docker-compose.yml", project: "" });

    expect(result.status).toBe("partial");
    expect(result.boundRequired).toEqual([5672]);
  });

  test("status 'none' when no published port is bound", async () => {
    mockDocker(composeConfig({ rabbitmq: [{ published: "5672" }] }), "");

    const result = await inspectServices({ file: "docker-compose.yml", project: "" });

    expect(result.status).toBe("none");
    expect(result.boundRequired).toEqual([]);
  });

  test("status 'none' when the file publishes no host ports", async () => {
    mockDocker(composeConfig({ worker: [] }), "some-container\t0.0.0.0:5672->5672/tcp\n");

    const result = await inspectServices({ file: "docker-compose.yml", project: "" });

    expect(result.status).toBe("none");
    expect(result.required).toEqual([]);
  });

  test("accepts a numeric published value", async () => {
    mockDocker(
      composeConfig({ redis: [{ published: 6379 }] }),
      "c\t0.0.0.0:6379->6379/tcp\n",
    );

    const result = await inspectServices({ file: "docker-compose.yml", project: "" });

    expect(result.required).toEqual([6379]);
    expect(result.status).toBe("all");
  });

  test("expands a published port range", async () => {
    mockDocker(composeConfig({ app: [{ published: "8000-8002" }] }), "");

    const result = await inspectServices({ file: "docker-compose.yml", project: "" });

    expect(result.required).toEqual([8000, 8001, 8002]);
  });

  test("degrades to 'none' when the config probe fails", async () => {
    mockDocker(composeConfig({ redis: [{ published: "6379" }] }), "", { configCode: 1 });

    const result = await inspectServices({ file: "docker-compose.yml", project: "" });

    expect(result.required).toEqual([]);
    expect(result.status).toBe("none");
  });

  test("degrades to 'none' when the config output is unparseable", async () => {
    mockCaptureOutput.mockImplementation(async (_command, args) => {
      if (args.includes("config")) return { code: 0, stdout: "not json{" };
      return { code: 0, stdout: "" };
    });

    const result = await inspectServices({ file: "docker-compose.yml", project: "" });

    expect(result.required).toEqual([]);
    expect(result.status).toBe("none");
  });
});
