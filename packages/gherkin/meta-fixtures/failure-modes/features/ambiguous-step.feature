Feature: ambiguous step reporting

  Scenario: a step two definitions match
    Given a duplicated step
    Then the scenario stops before this step
