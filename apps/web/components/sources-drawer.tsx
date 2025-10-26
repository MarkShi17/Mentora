'use client';

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import { cn } from "@/lib/cn";

export function SourcesDrawer() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const allSources = useSessionStore((state) => state.sources);
  const open = useSessionStore((state) => state.sourcesDrawerOpen);
  const setOpen = useSessionStore((state) => state.setSourcesDrawerOpen);
  const sources = activeSessionId ? allSources[activeSessionId] ?? [] : [];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-24 left-1/2 -translate-x-1/2 w-[28rem] max-w-[95vw] rounded-3xl glass-white border border-white/50 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.25)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-5 data-[state=closed]:slide-out-to-top-5 duration-300">
          <Dialog.Title className="text-xl font-black text-slate-900 tracking-tight">
            Referenced Sources
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600 font-medium mt-1">
            Indexed documents grounding the most recent response.
          </Dialog.Description>
          <div className="mt-6 max-h-96 space-y-3 overflow-y-auto pr-2 scrollbar-thin">
            {sources.map((source) => (
              <div
                key={source.id}
                className="rounded-2xl border border-white/60 bg-white/40 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
              >
                <div className="flex items-center justify-between">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-sky-600 hover:text-sky-700 transition-colors"
                  >
                    {source.title}
                  </a>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-black shadow-sm",
                      source.score > 0.9
                        ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-700 border border-emerald-400/30"
                        : source.score > 0.75
                          ? "bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-700 border border-sky-400/30"
                          : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 border border-amber-400/30"
                    )}
                  >
                    {(source.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-700 leading-relaxed font-medium">{source.snippet}</p>
              </div>
            ))}
            {sources.length === 0 ? (
              <p className="text-sm text-slate-600 font-medium text-center py-8">
                No sources yet. Ask a question to populate grounded references.
              </p>
            ) : null}
          </div>
          <Dialog.Close asChild>
            <Button className="mt-6 w-full rounded-2xl glass-white hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 border border-white/50 font-bold text-slate-700 py-3" variant="secondary">
              Close
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
