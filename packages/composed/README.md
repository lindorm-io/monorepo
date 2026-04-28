# @lindorm/composed

Run a command with Docker Compose services started up first, then tear them down on exit. Available as both a CLI (`composed`) and a programmatic API.

## Installation

```bash
npm install @lindorm/composed
```

This package is **ESM-only**. Use `import` syntax; `require()` will not work.

`composed` shells out to the host `docker` binary, so a working Docker installation with the Compose plugin (`docker compose ...`) is required at runtime.

## Features

- Runs `docker compose up -d --wait` before your command and `docker compose down --remove-orphans --volumes` after it.
- Resolves the compose file from an explicit `--file` argument or auto-discovers `docker-compose.yml` / `docker-compose.yaml` in the current working directory.
- Forwards `SIGINT`, `SIGTERM`, `SIGHUP`, and `SIGQUIT` from the parent process to the spawned command.
- Propagates the spawned command's exit code (and signal, encoded as `128 + signal`) as the process exit code.
- Quiet mode prints concise status lines with elapsed timings; verbose mode streams Docker output through.
- Honours `--no-teardown` and the `COMPOSED_NO_TEARDOWN=1` environment variable to keep services running after the command exits.

## CLI Usage

```bash
composed [options] <command> [args...]
```

Run a test suite with services from `docker-compose.yml` in the current directory:

```bash
composed vitest run
```

Specify a compose file and pass flags through to the wrapped command:

```bash
composed --file ./docker/test-compose.yml jest --runInBand
```

Build images before starting and keep services up after the command finishes:

```bash
composed --build --no-teardown npm test
```

Flags placed after `<command>` are forwarded to the command verbatim, so `composed jest -- --runInBand` works as expected.

### CLI Options

| Option                         | Default          | Description                                                                                                                       |
| ------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `-f, --file <path>`            | auto-discover    | Path to the compose file. If omitted, looks for `docker-compose.yml` then `docker-compose.yaml` in the current working directory. |
| `-v, --verbose`                | `false`          | Stream Docker stdout/stderr to the parent. When disabled, Docker output is buffered and only printed on failure.                  |
| `--build`                      | `false`          | Pass `--build` to `docker compose up`.                                                                                            |
| `--no-teardown`                | teardown enabled | Skip `docker compose down` after the command exits.                                                                               |
| `-w, --wait-timeout <seconds>` | `60`             | Timeout (in seconds) passed to `docker compose up --wait --wait-timeout`.                                                         |

### Environment Variables

| Variable                 | Effect                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `COMPOSED_NO_TEARDOWN=1` | Equivalent to passing `--no-teardown`; takes effect even when teardown is otherwise enabled. |

### Exit Codes

- The exit code of the wrapped command is propagated as-is.
- `1` if `docker compose up` fails.
- `127` if the wrapped command cannot be spawned (e.g. binary not found).
- `128 + n` if the wrapped command is terminated by a signal, where `n` is `SIGHUP=1`, `SIGINT=2`, `SIGQUIT=3`, `SIGTERM=15`. Other signals fall back to `15`.

## Programmatic Usage

```ts
import { composed, type ComposedOptions } from "@lindorm/composed";

const options: ComposedOptions = {
  file: "docker-compose.yml",
  verbose: false,
  build: false,
  teardown: true,
  waitTimeout: 60,
  command: "vitest",
  commandArgs: ["run"],
};

const exitCode = await composed(options);
process.exit(exitCode);
```

`composed` resolves and validates the compose file before any try/catch — pass an empty string for `file` to trigger auto-discovery, or a path that exists. If the file cannot be located, the returned promise rejects with a message identifying the missing file.

## API Reference

### `composed(options: ComposedOptions): Promise<number>`

Resolves the compose file, runs `docker compose up -d --wait`, spawns the requested command with inherited stdio, and (when `teardown` is `true`) runs `docker compose down --remove-orphans --volumes` afterwards. Resolves with the numeric exit code that the CLI would propagate.

### `ComposedOptions`

```ts
interface ComposedOptions {
  file: string;
  verbose: boolean;
  build: boolean;
  teardown: boolean;
  waitTimeout: number;
  command: string;
  commandArgs: Array<string>;
}
```

| Field         | Description                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`        | Path to the compose file. Pass `""` to auto-discover `docker-compose.yml` / `docker-compose.yaml` in the current working directory.                                                    |
| `verbose`     | When `true`, Docker output is streamed to the parent's stdio and the high-level status lines are suppressed. When `false`, Docker output is buffered and only printed if a step fails. |
| `build`       | When `true`, `--build` is passed to `docker compose up`.                                                                                                                               |
| `teardown`    | When `true`, `docker compose down --remove-orphans --volumes` runs after the command exits (even on failure).                                                                          |
| `waitTimeout` | Seconds passed to `docker compose up --wait --wait-timeout`.                                                                                                                           |
| `command`     | The command to spawn after services are healthy.                                                                                                                                       |
| `commandArgs` | Argument array forwarded to `command`.                                                                                                                                                 |

All fields are required; the CLI fills in defaults equivalent to those documented above.

## License

AGPL-3.0-or-later
