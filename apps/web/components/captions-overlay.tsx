'use client';

import { useSessionStore } from "@/lib/session-store";
import { AnimatePresence, motion } from "framer-motion";

export function CaptionsOverlay() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const transcripts = useSessionStore((state) => state.transcripts);
  const captionsEnabled = useSessionStore((state) => state.captionsEnabled);
  const text = activeSessionId ? transcripts[activeSessionId] ?? "" : "";

  return (
    <AnimatePresence>
      {captionsEnabled && text ? (
        <motion.div
          key="captions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none fixed bottom-24 left-1/2 w-[min(640px,90vw)] -translate-x-1/2 rounded-xl border border-sky-500/40 bg-slate-950/80 px-4 py-3 text-center text-sm text-slate-100 shadow-lg backdrop-blur"
        >
          {text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
