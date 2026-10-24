// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, toast } from "sonner";
import UpdateSettings from "./UpdateSettings";
it("reports a backend update failure through the top-center notification system", async () => {
  const update = vi
    .fn()
    .mockRejectedValue(Error("No backend release published"));
  window.desktop = { update } as any;
  render(
    <>
      <Toaster position="top-center" />
      <UpdateSettings />
    </>,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Check backend update" }));
  expect(
    await screen.findByText("Error: No backend release published"),
  ).toBeTruthy();
  expect(update).toHaveBeenCalledWith("backend-check");
  const toaster = document.querySelector("[data-sonner-toaster]");
  expect(toaster?.getAttribute("data-x-position")).toBe("center");
  expect(toaster?.getAttribute("data-y-position")).toBe("top");
  toast.dismiss();
  cleanup();
  delete window.desktop;
});
