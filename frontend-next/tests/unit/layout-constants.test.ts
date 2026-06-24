import { describe, expect, it } from "vitest";
import { LAYOUT_WIDTH } from "@/lib/layout/constants";

describe("layout constants", () => {
  it("matches CRA desktop layout widths", () => {
    expect(LAYOUT_WIDTH).toEqual({
      login: 1200,
      home: 960,
      app: 1280,
    });
  });
});
