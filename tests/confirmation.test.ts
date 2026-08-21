import { describe, it, expect } from "vitest";
import { parseConfirmation } from "../src/guards/confirmation.js";

describe("parseConfirmation", () => {
  it("recognizes English confirm/deny", () => {
    expect(parseConfirmation("yes")).toBe("confirm");
    expect(parseConfirmation("Yeah, go ahead")).toBe("unclear"); // not an exact phrase match by design
    expect(parseConfirmation("no")).toBe("deny");
    expect(parseConfirmation("Cancel")).toBe("deny");
  });

  it("recognizes Hebrew confirm/deny", () => {
    expect(parseConfirmation("כן")).toBe("confirm");
    expect(parseConfirmation("אישור")).toBe("confirm");
    expect(parseConfirmation("לא")).toBe("deny");
    expect(parseConfirmation("ביטול")).toBe("deny");
  });

  it("does not misclassify a denial containing a confirm substring", () => {
    // "לא מאשר" contains "מאשר" (a confirm word) but means "I do not confirm".
    expect(parseConfirmation("לא מאשר")).toBe("deny");
    expect(parseConfirmation("לא מאשרת")).toBe("deny");
  });

  it("returns unclear for anything else", () => {
    expect(parseConfirmation("maybe")).toBe("unclear");
    expect(parseConfirmation("what?")).toBe("unclear");
    expect(parseConfirmation("")).toBe("unclear");
  });
});
