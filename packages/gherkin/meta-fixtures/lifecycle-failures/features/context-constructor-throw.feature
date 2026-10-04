Feature: context constructor throw

  Scenario: a step demanding a broken context
    Given a step needing a broken context
    Then the scenario stops before this step
