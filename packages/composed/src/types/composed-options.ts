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
  waitTimeout: number;
  command: string;
  commandArgs: Array<string>;
}
