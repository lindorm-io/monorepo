Feature: green multi scenario

  Background:
    Given a counter starting at "1"

  Rule: increments accumulate

    Example: a single bump
      When I bump the counter by "2"
      Then the counter reads "3"

    Scenario Outline: bumps of every size
      When I bump the counter by "<bump>"
      Then the counter reads "<total>"

      Examples:
        | bump | total |
        | 1    | 2     |
        | 4    | 5     |
