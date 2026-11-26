import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { RecordTable } from "./RecordTable";
import { demoPreview } from "../services/demo";

afterEach(cleanup);

it("expõe a expansão e o valor informado do item", () => {
  render(<RecordTable records={demoPreview("details").records} />);
  const button = screen.getByRole("button", { name: "90001" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/R\$ 20,10/)).toBeInTheDocument();
  expect(screen.getByText(/BDV 321/)).toBeInTheDocument();
});
