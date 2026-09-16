import { useRef } from "react";

export function PaneResizer({
  side,
  onResize,
}: {
  side: "left" | "right";
  onResize: (width: number) => void;
}) {
  const start = useRef({ x: 0, width: 0 });
  const width = (element: HTMLElement) =>
    element.closest("aside")!.getBoundingClientRect().width;
  const update = (value: number) =>
    onResize(Math.max(235, Math.min(420, value)));
  return (
    <button
      className={`pane-resizer pane-resizer-${side}`}
      aria-label={`Resize ${side === "left" ? "shots" : "availability"} pane`}
      title="Drag to resize. Use arrow keys for small adjustments."
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        start.current = { x: event.clientX, width: width(event.currentTarget) };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const delta =
          (event.clientX - start.current.x) * (side === "left" ? 1 : -1);
        update(start.current.width + delta);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta =
          (event.key === "ArrowRight" ? 16 : -16) * (side === "left" ? 1 : -1);
        update(width(event.currentTarget) + delta);
      }}
    />
  );
}
