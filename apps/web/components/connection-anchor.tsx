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
  const baseSize = 12 / scale; // 12px circle that scales inversely with zoom
  const size = isHovered ? baseSize * 1.5 : baseSize; // Enlarge on hover
  // Always use baseSize for offset calculation to keep anchor centered at same position
  const offset = (baseSize * 1.5) / 2; // Use max size for offset so it stays centered

  // Determine colors based on state with modern glassy aesthetic
  const isDeleting = hasConnection && isHovered;
  const glowColor = isDeleting ? 'rgba(239, 68, 68, 0.4)' : 'rgba(6, 182, 212, 0.4)';
  const glowShadow = isDeleting
    ? '0 0 16px rgba(239, 68, 68, 0.8), 0 0 24px rgba(239, 68, 68, 0.4)'
    : '0 0 16px rgba(6, 182, 212, 0.8), 0 0 24px rgba(6, 182, 212, 0.4)';
  const bgColor = isDeleting
    ? '#ef4444'
    : (isActive || isHovered ? '#06b6d4' : 'rgba(255, 255, 255, 0.95)');
  const borderColor = isDeleting
    ? '#dc2626'
    : (isActive || isHovered ? '#0891b2' : 'rgba(148, 163, 184, 0.6)');
  const shadow = isDeleting
    ? '0 4px 12px rgba(239, 68, 68, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)'
    : (isActive || isHovered
      ? '0 4px 12px rgba(6, 182, 212, 0.5), 0 2px 6px rgba(0, 0, 0, 0.2)'
      : '0 2px 6px rgba(0, 0, 0, 0.15)');

  return (
    <>
      {/* Glow ring when hovered */}
      {isHovered && (
        <div
          className="absolute rounded-full pointer-events-none z-40"
          style={{
            left: x - offset - 4 / scale,
            top: y - offset - 4 / scale,
            width: size + 8 / scale,
            height: size + 8 / scale,
            backgroundColor: glowColor,
            boxShadow: glowShadow,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        />
      )}

      {/* Main anchor circle */}
      <div
        className="absolute pointer-events-auto rounded-full border-[3px] z-50"
        style={{
          left: x - offset,
          top: y - offset,
          width: size,
          height: size,
          backgroundColor: bgColor,
          borderColor: borderColor,
          cursor: 'crosshair',
          boxShadow: shadow,
          backdropFilter: 'blur(8px)',
          transition: 'background-color 0.2s, border-color 0.2s, box-shadow 0.2s, width 0.2s, height 0.2s'
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onPointerDown?.(e);
        }}
        onPointerEnter={(e) => {
          onPointerEnter?.(e);
        }}
        onPointerLeave={(e) => {
          onPointerLeave?.(e);
        }}
        title={hasConnection ? `Remove connection from ${anchor} side` : `Connect from ${anchor} side`}
      />
    </>
  );
}
