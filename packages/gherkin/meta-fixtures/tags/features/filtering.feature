@lane
Feature: runtime tag filtering

  @smoke
  Scenario: smoke only
    Given a noted step "smoke"

  @smoke @slow
  Scenario: smoke and slow
    Given a noted step "smoke-slow"

  Scenario: untagged
    Given a noted step "plain"
