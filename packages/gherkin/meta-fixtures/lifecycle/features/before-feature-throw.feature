@boom
Feature: before-feature throw

  Scenario: first scenario never runs
    Given a lifecycle step
    Then the lifecycle step ran

  Scenario: second scenario never runs
    Given a lifecycle step
    Then the lifecycle step ran
