Feature: no lowering

  Scenario: never runs
    Given a step that never runs
    Then the step module never loads
