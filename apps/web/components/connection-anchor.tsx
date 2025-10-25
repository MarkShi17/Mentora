'use client';

import type { ConnectionAnchor as AnchorType } from '@/types';

type ConnectionAnchorProps = {
  anchor: AnchorType;
  x: number;
  y: number;
  scale: number;
  isActive?: boolean;
  isHovered?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
};

export function ConnectionAnchor({
  anchor,
  x,
  y,
  scale,
  isActive = false,
  isHovered = false,
  onPointerDown
}: ConnectionAnchorProps) {
  const baseSize = 10 / scale; // 10px circle that scales inversely with zoom
  const size = isHovered ? baseSize * 1.4 : baseSize; // Enlarge on hover
  const offset = size / 2;

  return (
    <>
      {/* Glow ring when hovered */}
      {isHovered && (
        <div
          className="absolute rounded-full pointer-events-none z-40 animate-pulse"
          style={{
            left: x - offset - 4 / scale,
            top: y - offset - 4 / scale,
            width: size + 8 / scale,
            height: size + 8 / scale,
            backgroundColor: 'rgba(14, 165, 233, 0.3)',
            boxShadow: '0 0 12px rgba(14, 165, 233, 0.6)'
          }}
        />
      )}

      {/* Main anchor circle */}
      <div
        className="absolute pointer-events-auto rounded-full border-2 z-50"
        style={{
          left: x - offset,
          top: y - offset,
          width: size,
          height: size,
          backgroundColor: isActive || isHovered ? '#0ea5e9' : 'white',
          borderColor: isActive || isHovered ? '#0284c7' : '#64748b',
          cursor: 'crosshair',
          boxShadow: isActive || isHovered
            ? '0 0 8px rgba(14, 165, 233, 0.8), 0 2px 4px rgba(0, 0, 0, 0.2)'
            : '0 1px 3px rgba(0, 0, 0, 0.2)'
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onPointerDown?.(e);
        }}
        title={`Connect from ${anchor} side`}
      />
    </>
  );
}
