@hooked
Feature: feature hooks green

  Scenario: runs between the feature hooks
    Given a lifecycle step
    Then the lifecycle step ran
