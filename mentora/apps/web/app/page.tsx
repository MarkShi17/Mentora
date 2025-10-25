import { ActiveSessionHeader } from "@/components/active-session-header";
import { CanvasStage } from "@/components/canvas-stage";
import { CaptionsOverlay } from "@/components/captions-overlay";
import { PromptBar } from "@/components/prompt-bar";
import { SidebarHistory } from "@/components/sidebar-history";
import { SourcesDrawer } from "@/components/sources-drawer";
import { TimelinePanel } from "@/components/timeline-panel";

export default function HomePage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <SidebarHistory />
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <ActiveSessionHeader />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-border bg-slate-950/60 shadow-inner">
            <CanvasStage />
          </div>
          <PromptBar />
        </div>
      </section>
      <TimelinePanel />
      <SourcesDrawer />
      <CaptionsOverlay />
    </div>
  );
}
