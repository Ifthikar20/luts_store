// Makes vitest globals (describe/it/expect/vi) and the @testing-library/jest-dom
// matchers (toBeInTheDocument, toHaveAttribute, ...) type-check without adding a
// restrictive `types` array to tsconfig (which would drop Next's auto types).
/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";
