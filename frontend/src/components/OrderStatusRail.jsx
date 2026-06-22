import React from "react";

const STAGES = [
  { key: "placed", label: "Placed" },
  { key: "accepted", label: "Accepted" },
  { key: "packing", label: "Packing" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

const TERMINAL_NEGATIVE = ["rejected", "cancelled"];

export default function OrderStatusRail({ status, compact = false }) {
  if (TERMINAL_NEGATIVE.includes(status)) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "var(--danger)",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)", textTransform: "capitalize" }}>
          {status}
        </span>
      </div>
    );
  }

  const currentIdx = STAGES.findIndex((s) => s.key === status);

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {STAGES.map((stage, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const nodeColor = isFuture ? "var(--sage-200)" : isCurrent ? "var(--tomato-500)" : "var(--forest-500)";
        return (
          <React.Fragment key={stage.key}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: compact ? "none" : 1 }}>
              <div
                style={{
                  width: isCurrent ? 14 : 10,
                  height: isCurrent ? 14 : 10,
                  borderRadius: "50%",
                  background: nodeColor,
                  boxShadow: isCurrent ? "0 0 0 4px rgba(232,93,78,0.18)" : "none",
                  transition: "all 0.3s ease",
                }}
              />
              {!compact && (
                <span
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 500,
                    color: isFuture ? "var(--charcoal-300)" : "var(--charcoal-900)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stage.label}
                </span>
              )}
            </div>
            {idx < STAGES.length - 1 && (
              <div
                style={{
                  flex: compact ? "0 0 18px" : 1,
                  height: 2,
                  background: idx < currentIdx ? "var(--forest-500)" : "var(--sage-200)",
                  marginBottom: compact ? 0 : 18,
                  transition: "background 0.3s ease",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
