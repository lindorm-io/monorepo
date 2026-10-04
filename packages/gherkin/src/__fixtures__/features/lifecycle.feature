@lifecycle
Feature: Gherkin lifecycle integration

  Scenario: hooks bracket the steps in total order
    Given alpha touches the shared context
    When beta touches the shared context
    Then the shared context recorded both touches

  Scenario: the previous scenario's lifecycle was fully recorded
    Given the scenario "hooks bracket the steps in total order" has finished
    Then the recorded lifecycle for "hooks bracket the steps in total order" is complete
