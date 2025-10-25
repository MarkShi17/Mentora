'use client';

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const settings = useSessionStore((state) => state.settings);
  const updateSettings = useSessionStore((state) => state.updateSettings);

  const [preferredName, setPreferredName] = useState(settings.preferredName || "");
  const [voice, setVoice] = useState(settings.voice || "alloy");
  const [explanationLevel, setExplanationLevel] = useState(settings.explanationLevel || "intermediate");

  const handleSave = () => {
    updateSettings({
      preferredName,
      voice,
      explanationLevel
    });
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 max-w-[95vw] rounded-xl border border-slate-200 bg-white p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200">
          <Dialog.Title className="text-xl font-bold text-slate-900 mb-2">
            Settings
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600 mb-6">
            Customize your Mentora experience
          </Dialog.Description>

          <div className="space-y-5">
            {/* Preferred Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Preferred Name
              </label>
              <input
                type="text"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-slate-500">
                Mentora will refer to you by this name
              </p>
            </div>

            {/* Desired Voice */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Desired Voice
              </label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="alloy">Alloy (Neutral)</option>
                <option value="echo">Echo (Male)</option>
                <option value="fable">Fable (British Male)</option>
                <option value="onyx">Onyx (Deep Male)</option>
                <option value="nova">Nova (Female)</option>
                <option value="shimmer">Shimmer (Soft Female)</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Choose the voice for audio responses
              </p>
            </div>

            {/* Default Explanation Level */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Default Explanation Level
              </label>
              <div className="space-y-2">
                {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                  <label
                    key={level}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="explanationLevel"
                      value={level}
                      checked={explanationLevel === level}
                      onChange={(e) => setExplanationLevel(e.target.value)}
                      className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900 capitalize">
                        {level}
                      </p>
                      <p className="text-xs text-slate-500">
                        {level === 'beginner' && 'Simple explanations with lots of examples'}
                        {level === 'intermediate' && 'Balanced detail and clarity'}
                        {level === 'advanced' && 'Technical depth and precision'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Dialog.Close asChild>
              <Button variant="ghost" className="flex-1 text-gray-800 hover:text-white">
                Cancel
              </Button>
            </Dialog.Close>
            <Button onClick={handleSave} variant="default" className="flex-1">
              Save Settings
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
