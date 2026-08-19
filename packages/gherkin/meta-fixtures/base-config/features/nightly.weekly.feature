Feature: Weekly notebook sweep

  Example: a weekly-lane note round-trips
    Given a fresh notebook
    When I write "weekly note"
    Then reading returns "weekly note"
