Feature: step argument reporting

  Scenario: a doc string is not deliverable
    Given a documented step
      """
      payload
      """

  Scenario: a data table is not deliverable
    Given a tabulated step
      | left | right |
      | 1    | 2     |
