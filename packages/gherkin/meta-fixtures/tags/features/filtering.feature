@lane
Feature: runtime tag filtering

  @smoke
  Scenario: smoke only
    Given a noted step "smoke"
    Then the note reads "smoke"

  @smoke @slow
  Scenario: smoke and slow
    Given a noted step "smoke-slow"
    Then the note reads "smoke-slow"

  Scenario: untagged
    Given a noted step "plain"
    Then the note reads "plain"
