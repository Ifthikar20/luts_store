// Global test setup: registers @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveAttribute, ...) and clears mocks/storage between tests for isolation.
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom storage may be unavailable in some envs — non-fatal */
  }
});
