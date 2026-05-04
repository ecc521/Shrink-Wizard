import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DropZone } from "./DropZone";
import type { QueueJob } from "../../../shared/ipc-types";

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  HardDrive: () => <div data-testid="icon-hard-drive" />,
  Upload: () => <div data-testid="icon-upload" />,
}));

describe("DropZone UI Component", () => {
  it("renders strictly in the empty idle dashboard state", () => {
    // Array of active job ids should be empty for idle state
    const mockFiles: QueueJob[] = [];
    render(
      <DropZone
        isDragActive={false}
        activeQueue={mockFiles}
        handleSelectFiles={vi.fn()}
        isCompress={true}
      />,
    );

    // The component acts as a pure layout module, ALWAYS rendering its core prompts natively
    expect(screen.getByText("Drop Files & Folders Here")).toBeInTheDocument();

    // Ensure the conditional Start button is injected
    expect(screen.getByText("Shrink!")).toBeInTheDocument();
  });

  it("renders active drag states", () => {
    const activeQueue: QueueJob[] = [];
    render(
      <DropZone
        isDragActive={true}
        activeQueue={activeQueue}
        handleSelectFiles={vi.fn()}
        isCompress={true}
      />,
    );

    expect(screen.getByText("Drop Files & Folders Here")).toBeInTheDocument();
  });
});
