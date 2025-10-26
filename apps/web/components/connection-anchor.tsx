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
  // Refined sizing that scales properly with zoom
  const baseSize = 12 / scale;
  const size = isHovered || isActive ? baseSize * 1.3 : baseSize;
  const offset = size / 2;

  // Enhanced color scheme with better contrast
  const bgColor = hasConnection
    ? '#3b82f6' // vibrant blue when connected
    : isActive || isHovered
      ? '#8b5cf6' // vibrant purple when active/hovered
      : '#64748b'; // slate gray when idle

  // Ring effect for better visibility
  const ringColor = isActive || isHovered
    ? 'rgba(139, 92, 246, 0.25)'
    : 'rgba(100, 116, 139, 0.15)';

  return (
    <div
      className="absolute pointer-events-auto z-50 transition-all duration-200 ease-out"
      style={{
        left: x - offset,
        top: y - offset,
        width: size,
        height: size,
        cursor: 'pointer',
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
      title={hasConnection ? `Connected` : `Connect to another object`}
    >
      {/* Outer ring for hover/active state */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-200"
        style={{
          backgroundColor: ringColor,
          transform: isHovered || isActive ? 'scale(1.8)' : 'scale(1.2)',
          opacity: isHovered || isActive ? 1 : 0,
        }}
      />
      {/* Main anchor circle */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-200"
        style={{
          backgroundColor: bgColor,
          boxShadow: isHovered || isActive
            ? '0 0 0 2px white, 0 2px 8px rgba(0, 0, 0, 0.15)'
            : '0 1px 3px rgba(0, 0, 0, 0.2)',
          border: hasConnection ? '2px solid white' : 'none'
        }}
      />
      {/* Inner dot for connected state */}
      {hasConnection && (
        <div
          className="absolute inset-0 flex items-center justify-center"
        >
          <div
            className="rounded-full bg-white transition-all duration-200"
            style={{
              width: size * 0.35,
              height: size * 0.35,
            }}
          />
        </div>
      )}
    </div>
  );
}
