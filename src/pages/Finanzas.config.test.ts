import { describe, expect, it } from "vitest";
import { CXP_LOTES_SELECT_FIELDS } from "./Finanzas";

describe("Finanzas CxP config", () => {
  it("usa solo peso_neto para lotes en CxP", () => {
    expect(CXP_LOTES_SELECT_FIELDS).toContain("peso_neto");
    expect(CXP_LOTES_SELECT_FIELDS).not.toContain("peso_pagable");
  });
});
