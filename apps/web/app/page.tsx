import { CanvasStage } from "@/components/canvas-stage";
import { CaptionsOverlay } from "@/components/captions-overlay";
import { PromptBar } from "@/components/prompt-bar";
import { FloatingHeader } from "@/components/floating-header";
import { SidebarHistory } from "@/components/sidebar-history";
import { SourcesDrawer } from "@/components/sources-drawer";
import { TimelinePanel } from "@/components/timeline-panel";

export default function HomePage() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <SidebarHistory />
      <section className="relative min-w-0 flex-1">
        <CanvasStage />
        <FloatingHeader />
        <PromptBar />
        <TimelinePanel />
      </section>
      <SourcesDrawer />
      <CaptionsOverlay />
    </div>
  );
}
