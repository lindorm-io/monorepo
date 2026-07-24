export interface ComposedOptions {
  file: string;
  /**
   * Docker Compose project name (`docker compose -p <name>`). Empty string uses
   * Compose's default (the compose file's directory basename). Set it to run
   * the same compose file under an isolated namespace — e.g. `<app>-test`, so a
   * test run's volumes never touch the dev stack's. Mirrors docker's own `-p`.
   */
  project: string;
  verbose: boolean;
  build: boolean;
  teardown: boolean;
  /**
   * Keep named volumes on teardown — run `docker compose down` without
   * `--volumes`. Default (`false`) wipes volumes for a clean slate, which suits
   * test suites; long-lived dev services (a dev database) set this to persist
   * data across restarts. Ignored when `teardown` is `false`.
   */
  keepVolumes: boolean;
  /**
   * Reuse an already-running service stack instead of starting a fresh one. When
   * every host port the compose file publishes is already served by a running
   * container, `composed` attaches to it: it skips `docker compose up` AND skips
   * teardown (leave-as-found — it never tears down a stack it did not start).
   * When only SOME required ports are taken (a genuine conflict), it fails fast
   * with an actionable message naming the ports and their holders. When none are
   * bound, it starts and tears down the stack normally. Opt-in — the default
   * (`false`) always runs a fresh, torn-down stack so a suite keeps its clean
   * slate.
   */
  reuse: boolean;
  waitTimeout: number;
  command: string;
  commandArgs: Array<string>;
}
