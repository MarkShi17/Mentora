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
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-20 left-1/2 -translate-x-1/2 w-96 max-w-[95vw] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-5 data-[state=closed]:slide-out-to-top-5 duration-200">
          <Dialog.Title className="text-lg font-semibold text-slate-900">
            Referenced Sources
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600">
            Indexed documents grounding the most recent response.
          </Dialog.Description>
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {sources.map((source) => (
              <div
                key={source.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-sky-600 hover:underline"
                  >
                    {source.title}
                  </a>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      source.score > 0.9
                        ? "bg-emerald-500/20 text-emerald-700"
                        : source.score > 0.75
                          ? "bg-sky-500/20 text-sky-700"
                          : "bg-amber-500/20 text-amber-700"
                    )}
                  >
                    {(source.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{source.snippet}</p>
              </div>
            ))}
            {sources.length === 0 ? (
              <p className="text-sm text-slate-600">
                No sources yet. Ask a question to populate grounded references.
              </p>
            ) : null}
          </div>
          <Dialog.Close asChild>
            <Button className="mt-4 w-full" variant="secondary">
              Close
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
