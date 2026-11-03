import { describe, expect, it } from "vitest";
import { formatRs, normalizePkPhone, waLink, fillTemplate } from "@/lib/format";

describe("format", () => {
  it("formats rupees", () => {
    expect(formatRs(23000)).toBe("Rs 23,000");
    expect(formatRs("1500.5")).toBe("Rs 1,500.50");
  });
  it("normalizes PK numbers", () => {
    expect(normalizePkPhone("0300-1234567")).toBe("923001234567");
    expect(normalizePkPhone("+92 300 1234567")).toBe("923001234567");
    expect(normalizePkPhone("3001234567")).toBe("923001234567");
    expect(normalizePkPhone("12345")).toBeNull();
  });
  it("builds wa.me link", () => {
    expect(waLink("03001234567", "Hi there")).toBe("https://wa.me/923001234567?text=Hi%20there");
  });
  it("fills template", () => {
    expect(fillTemplate("Hi {patient_name}, Rs {pending_amount}", { patient_name: "Ali", pending_amount: "5,000" })).toBe("Hi Ali, Rs 5,000");
  });
});
