import React from "react";
import { Upload } from "lucide-react";
import { QueueJob } from "../../../shared/ipc-types";

export function DropZone({
  isDragActive,
  activeQueue,
  handleSelectFiles,
  isCompress,
}: {
  isDragActive: boolean;
  activeQueue: QueueJob[];
  handleSelectFiles: (selectFiles: boolean) => void;
  isCompress: boolean;
}) {
  return (
    <>
      <div
        className="droppable-area"
        style={{
          borderColor: isDragActive ? "var(--accent-primary)" : "var(--border)",
          background: isDragActive ? "var(--bg-secondary)" : "var(--bg-root)",
        }}
      >
        <div className="icon-wrap">
          <Upload size={32} className="text-secondary" />
        </div>
        <h3>Drop Files & Folders Here</h3>
        <p>Or use the buttons below to browse your computer</p>

        {activeQueue.length === 0 && (
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <button
              className="btn btn-outline"
              style={{
                fontSize: "13px",
                padding: "8px 16px",
                borderRadius: "16px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFiles(false);
              }}
            >
              Select Folders
            </button>
            <button
              className="btn btn-outline"
              style={{
                fontSize: "13px",
                padding: "8px 16px",
                borderRadius: "16px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectFiles(true);
              }}
            >
              Select Files
            </button>
          </div>
        )}
      </div>

      {activeQueue.length === 0 && (
        <div
          style={{
            background: "var(--bg-secondary)",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              display: "flex",
              gap: "16px",
              background: "var(--bg-root)",
            }}
          >
            <button
              className="btn btn-primary"
              style={{
                flex: 1,
                padding: "14px",
                fontSize: "16px",
                fontWeight: "600",
                opacity: 0.5,
                cursor: "not-allowed",
              }}
            >
              {isCompress ? "Shrink!" : "Decompress!"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
