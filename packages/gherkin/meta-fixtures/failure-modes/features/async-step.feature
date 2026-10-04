Feature: async step failure
  Scenario: a rejecting async step fails the scenario
    Given a tick of 1 ms
    When an async step rejects after a tick
    Then the scenario stops before this step
