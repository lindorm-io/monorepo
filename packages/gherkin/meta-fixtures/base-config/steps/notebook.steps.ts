import { expect } from "vitest";
import { Binding, Given, Then, When } from "../../../src/index.js";

/**
 * One flat step namespace for all three cadence-lane features — which lane
 * ran is asserted via the parent's count/scenario-name checks, never here.
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
