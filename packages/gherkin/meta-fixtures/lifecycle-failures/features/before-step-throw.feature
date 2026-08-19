@step-before-boom
Feature: before-step throw

  Scenario: the guarded step body never runs
    Given a guarded step
    And a trailing guarded step
