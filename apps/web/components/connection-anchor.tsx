'use client';

import type { ConnectionAnchor as AnchorType } from '@/types';

type ConnectionAnchorProps = {
  anchor: AnchorType;
  x: number;
  y: number;
  scale: number;
  isActive?: boolean;
  isHovered?: boolean;
  hasConnection?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerEnter?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
};

export function ConnectionAnchor({
  anchor,
  x,
  y,
  scale,
  isActive = false,
  isHovered = false,
  hasConnection = false,
  onPointerDown,
  onPointerEnter,
  onPointerLeave
}: ConnectionAnchorProps) {
  // Small, minimal connector that scales with zoom
  const baseSize = 10 / scale;
  const size = isHovered ? baseSize * 1.4 : baseSize;
  const offset = size / 2;

  // Clean, modern color scheme
  const bgColor = hasConnection 
    ? '#3b82f6' // blue when connected
    : isActive || isHovered
      ? '#8b5cf6' // purple when active/hovered
      : 'rgba(0, 0, 0, 0.6)'; // subtle gray when idle

  return (
    <div
      className="absolute pointer-events-auto rounded-full z-50 transition-all duration-200"
      style={{
        left: x - offset,
        top: y - offset,
        width: size,
        height: size,
        backgroundColor: bgColor,
        cursor: 'pointer',
        boxShadow: isHovered || isActive 
          ? '0 0 0 2px white, 0 0 0 4px rgba(139, 92, 246, 0.3)' 
          : '0 1px 3px rgba(0, 0, 0, 0.2)',
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPointerDown?.(e);
      }}
      onPointerEnter={(e) => {
        e.stopPropagation();
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        onPointerLeave?.(e);
      }}
      title={hasConnection ? `Remove connection` : `Add connection`}
    />
  );
}
