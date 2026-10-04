Feature: pending step reporting

  Scenario: an unimplemented body
    Given a pending step
    Then the scenario stops before this step
