import { expect, test } from "vitest";

// The sabotage control: vitest.overwrite.config.ts points test.include at
// THIS file alone, so a run that gets past the collection guard still prints
// green counts — the silently-absent-features lie the guard exists to kill.
// Outside src/, so the healthy modes never collect it.
test("sanity: the overwritten include still collects something", () => {
  expect(1 + 1).toBe(2);
});
