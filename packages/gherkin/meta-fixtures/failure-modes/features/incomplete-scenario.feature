Feature: incomplete scenario reporting

  Scenario: a scenario that never asserts
    Given an unchecked situation
    When an unchecked action

  Scenario: a scenario that asserts against nothing it established
    When an unchecked action
    Then an unchecked outcome

  Scenario: a scenario written only in stars
    * an unchecked situation
    * an unchecked outcome

  Scenario Outline: an outline row <row> that never asserts
    Given an unchecked situation

    Examples:
      | row |
      | 1   |
      | 2   |
