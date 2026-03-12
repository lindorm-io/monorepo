import { ShaKit } from "@lindorm/sha";

export const computeHash = (migration: { up: Function; down: Function }): string =>
  ShaKit.S256(migration.up.toString() + "\n---\n" + migration.down.toString());
