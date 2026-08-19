import { expect } from "vitest";
import { Binding, Given, Then, When } from "../index.js";

/**
 * Step definitions for the in-package feature run (round-trip.feature) — the
 * proof that plugin → emitter → runtime → registry → execution compose
 * in-process. Loaded via the plugin's step glob, never imported by tests.
 */
@Binding()
export class NotebookSteps {
  private note!: string;

  @Given("a fresh notebook")
  aFreshNotebook(): void {
    this.note = "";
  }

  @When("I write {string}")
  iWrite(note: string): void {
    this.note = note;
  }

  @Then("reading returns {string}")
  readingReturns(expected: string): void {
    expect(this.note).toBe(expected);
  }
}
