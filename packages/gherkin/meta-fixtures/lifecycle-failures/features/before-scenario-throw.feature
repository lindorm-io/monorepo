@before-boom
Feature: before-scenario throw

  Scenario: steps never run but teardown does
    Given a seeded first step
    And a seeded second step
