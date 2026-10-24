// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import JsonEditor from "./JsonEditor";
afterEach(cleanup);
function Document() {
  const [value, setValue] = useState('{"ready":false,"values":[1,null]}');
  return (
    <>
      <JsonEditor label="Document" value={value} onChange={setValue} />
      <output>{value}</output>
    </>
  );
}
it("preserves JSON types and array structure across GUI edits", () => {
  render(<Document />);
  fireEvent.click(screen.getByLabelText("$.ready value"));
  expect(JSON.parse(screen.getByRole("status").textContent!).ready).toBe(true);
  fireEvent.change(screen.getByLabelText("$.values.0 value"), {
    target: { value: "-2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  expect(JSON.parse(screen.getByRole("status").textContent!).values).toEqual([
    -2,
    null,
    null,
  ]);
});
it("retains an invalid text draft until corrected and returns to the GUI", () => {
  render(<Document />);
  fireEvent.change(screen.getByLabelText("Document editing mode"), {
    target: { value: "text" },
  });
  const text = screen.getByLabelText("Document");
  fireEvent.change(text, { target: { value: '{"broken":' } });
  expect(screen.getByRole("alert").textContent).toContain("Invalid JSON");
  expect((text as HTMLTextAreaElement).value).toBe('{"broken":');
  fireEvent.change(text, { target: { value: '{"fixed":true}' } });
  fireEvent.change(screen.getByLabelText("Document editing mode"), {
    target: { value: "gui" },
  });
  expect(
    (screen.getByLabelText("$.fixed value") as HTMLInputElement).checked,
  ).toBe(true);
});

it("offers declared optional parameters with their defaults and descriptions", () => {
  function Form() {
    const [value, setValue] = useState("{}");
    return (
      <>
        <JsonEditor
          label="Parameters"
          value={value}
          onChange={setValue}
          schema={{
            type: "object",
            properties: {
              workers: {
                type: "integer",
                default: 4,
                description: "Shared workers",
              },
            },
            additionalProperties: false,
          }}
        />
        <output>{value}</output>
      </>
    );
  }
  render(<Form />);
  fireEvent.change(screen.getByLabelText("$ available parameters"), {
    target: { value: "workers" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add parameter" }));
  expect(JSON.parse(screen.getByRole("status").textContent!).workers).toBe(4);
  expect(screen.getByText("Shared workers")).toBeTruthy();
  expect(screen.queryByPlaceholderText("New field name")).toBeNull();
});
