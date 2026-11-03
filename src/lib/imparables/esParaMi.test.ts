import { describe, expect, it } from "vitest";
import { FRANJA, boldParts } from "./esParaMi";

describe("the gold strip", () => {
  it("says the three words and «manicuristas» in bold", () => {
    expect(boldParts(FRANJA)).toEqual([
      { text: "Congreso virtual de ", bold: false },
      { text: "mentalidad, dinero y marketing", bold: true },
      { text: " para ", bold: false },
      { text: "manicuristas", bold: true },
      { text: " que saben que pueden más", bold: false },
    ]);
  });

  it("leaves text without marks as it is", () => {
    expect(boldParts("Congreso virtual")).toEqual([{ text: "Congreso virtual", bold: false }]);
    expect(boldParts("**todo**")).toEqual([{ text: "todo", bold: true }]);
  });
});
