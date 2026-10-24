// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowLibrary from "./WorkflowLibrary";
import type { Api } from "./api";
afterEach(cleanup);
it("activates a published workflow, saves a named copy, updates it, renames and deletes the saved copy", async () => {
  const document = {
    solver: { backward_chain: {} },
    goal: { "metadata-value": { path: "properties.ready", value: true } },
  };
  const saved = new Map<string, any>();
  const request = vi.fn(async (path: string, method = "GET", body?: any) => {
    if (path.endsWith("/available"))
      return {
        format_version: 1,
        workflows: [
          {
            id: "published",
            version: "1.0.0",
            description: "Published metadata goal",
          },
        ],
      };
    if (path.endsWith("/published/published")) return { document };
    if (path === "autostacgis/workflows" && method === "GET")
      return [...saved.values()];
    if (path === "autostacgis/workflows" && method === "POST") {
      const row = { id: body.name, document: body.document };
      saved.set(row.id, row);
      return row;
    }
    const id = decodeURIComponent(path.split("/").at(-1)!);
    if (method === "PUT") {
      saved.set(id, { id, document: body });
      return saved.get(id);
    }
    if (method === "PATCH") {
      const row = { ...saved.get(id), id: body.name };
      saved.delete(id);
      saved.set(row.id, row);
      return row;
    }
    if (method === "DELETE") {
      saved.delete(id);
      return { id };
    }
    throw Error(path);
  });
  function Form() {
    const [value, setValue] = useState({}),
      [active, setActive] = useState<string | null>(null);
    return (
      <>
        <WorkflowLibrary
          api={{ request } as unknown as Api}
          document={() => value}
          activate={setValue}
          active={active}
          setActive={setActive}
        />
        <output>{JSON.stringify(value)}</output>
      </>
    );
  }
  render(<Form />);
  const user = userEvent.setup();
  await screen.findByRole("option", { name: "published · 1.0.0" });
  await user.selectOptions(
    screen.getByLabelText("Published workflows"),
    "published",
  );
  await user.click(screen.getByRole("button", { name: "Activate published" }));
  await waitFor(() =>
    expect(JSON.parse(screen.getByRole("status").textContent!)).toEqual(
      document,
    ),
  );
  await user.click(screen.getByRole("button", { name: "Save a copy" }));
  await user.clear(screen.getByLabelText("Workflow name"));
  await user.type(screen.getByLabelText("Workflow name"), "Saved copy");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("button", { name: "Update saved workflow" });
  expect(saved.get("Saved copy").document).toEqual(document);
  await user.click(
    screen.getByRole("button", { name: "Update saved workflow" }),
  );
  await user.click(screen.getByRole("button", { name: "Rename" }));
  await user.clear(screen.getByLabelText("Workflow name"));
  await user.type(screen.getByLabelText("Workflow name"), "Renamed");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("option", { name: "Renamed" });
  expect(saved.has("Saved copy")).toBe(false);
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(saved.size).toBe(0));
  expect(
    screen.queryByRole("button", { name: "Update saved workflow" }),
  ).toBeNull();
});
