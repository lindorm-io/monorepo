@wip
Feature: draft

  Scenario: an excluded feature outside test.dir never becomes a test
    Given a collected feature runs
    Then the collected feature ran
