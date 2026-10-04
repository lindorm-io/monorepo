Feature: conversion failure reporting

  Scenario: a sync transform throws
    Given a failing value "boom"
    Then the scenario stops before this step

  Scenario: an async transform rejects before the step body runs
    Given a rejecting value "kaboom"
    Then the scenario stops before this step

  Scenario: an async transform resolves into the step body
    Given an upper value "fine"
    Then the upper value reads "FINE"
