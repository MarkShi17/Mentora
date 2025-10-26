'use client';

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRef, useEffect } from "react";

type ObjectContextMenuProps = {
  position: { x: number; y: number };
  onClose: () => void;
  selectedObjectIds: string[];
  onDelete: (objectIds: string[]) => void;
};

export function ObjectContextMenu({ position, onClose, selectedObjectIds, onDelete }: ObjectContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    {
      icon: Trash2,
      label: "Delete",
      action: () => onDelete(selectedObjectIds),
      danger: true
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-lg border border-slate-200 bg-white shadow-xl py-1 animate-in fade-in-0 zoom-in-95 duration-100"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.action();
            onClose();
          }}
          className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors ${
            item.danger
              ? "text-red-600 hover:bg-red-50"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

type ObjectMenuButtonProps = {
  onOpenMenu: (event: React.MouseEvent) => void;
};

export function ObjectMenuButton({ onOpenMenu }: ObjectMenuButtonProps) {
  return (
    <button
      onClick={onOpenMenu}
      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white transition-all hover:bg-sky-700 hover:scale-110 active:scale-95"
    >
      <MoreHorizontal className="h-3 w-3" />
    </button>
  );
}
