"use client";

import { useState } from "react";
import { Summary } from "@/components/Summary";
import { StudyGuide } from "@/components/StudyGuide";
import { MindMap } from "@/components/MindMap";
import { AudioOverview } from "@/components/AudioOverview";
import type { AudioScriptLine, AudioStatus } from "@/lib/types";

const SUMMARY_ICON_PATHS = ["M4 6h16", "M4 12h16", "M4 18h10"];
const STUDY_GUIDE_ICON_PATHS = [
  "M4 19.5A2.5 2.5 0 0 1 6.5 17H20",
  "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
];
const MIND_MAP_ICON_PATHS = [
  "M3 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
  "M17 5a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
  "M17 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
  "M17 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0",
  "M7 12h5M12 12L17 5M12 12L17 12M12 12L17 19",
];
const AUDIO_OVERVIEW_ICON_PATHS = ["M4 9a8 8 0 1 1 5.6 7.6", "M4 9v5h5", "M12 8v4l3 2"];

function CollapsedIconButton({
  paths,
  label,
  onClick,
}: {
  paths: string[];
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-icon btn-ghost"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </button>
  );
}

// Einklappbare rechte Sidebar fuer die "Generieren"-Funktionen (Study Guide
// & FAQ, Audio Overview) -- vorher Teil der linken Quellen-Sidebar, jetzt
// als eigener, minimierbarer Bereich analog zum ueberarbeiteten Design.
export function GenerateSidebar({
  notebookId,
  hasSources,
  summary,
  summarizing,
  summaryOpen,
  onToggleSummary,
  initialStudyGuide,
  initialMindMap,
  initialAudioScript,
  initialAudioClipUrls,
  initialAudioStatus,
}: {
  notebookId: string;
  hasSources: boolean;
  summary: string | null;
  summarizing: boolean;
  summaryOpen: boolean;
  onToggleSummary: () => void;
  initialStudyGuide: string | null;
  initialMindMap: string | null;
  initialAudioScript: AudioScriptLine[] | null;
  initialAudioClipUrls: (string | null)[] | null;
  initialAudioStatus: AudioStatus;
}) {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className="flex shrink-0 flex-col overflow-y-auto overflow-x-hidden border-l border-divider transition-[width] duration-[180ms] ease-in-out"
      style={{ width: open ? "25%" : 56 }}
    >
      <div
        className={`flex shrink-0 items-center px-3.5 pt-4 pb-2 ${open ? "justify-between" : "justify-center"}`}
      >
        {open && <h6 className="m-0 whitespace-nowrap text-neutral-400">Generieren</h6>}
        <button
          type="button"
          className="btn btn-icon btn-ghost"
          onClick={() => setOpen((o) => !o)}
          title={open ? "Einklappen" : "Ausklappen"}
          aria-label={open ? "Einklappen" : "Ausklappen"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-150"
            style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {open ? (
        <div className="flex w-full min-w-0 flex-col gap-[22px] px-5 pt-2 pb-5">
          <Summary
            summary={summary}
            summarizing={summarizing}
            open={summaryOpen}
            onToggle={onToggleSummary}
          />

          <div className="hr" />

          <StudyGuide
            notebookId={notebookId}
            hasSources={hasSources}
            initialStudyGuide={initialStudyGuide}
          />

          <div className="hr" />

          <MindMap
            notebookId={notebookId}
            hasSources={hasSources}
            initialMindMap={initialMindMap}
          />

          <div className="hr" />

          <AudioOverview
            notebookId={notebookId}
            hasSources={hasSources}
            initialScript={initialAudioScript}
            initialClipUrls={initialAudioClipUrls}
            initialStatus={initialAudioStatus}
          />
        </div>
      ) : (
        <div className="flex w-14 flex-col items-center gap-3 pt-0.5">
          <CollapsedIconButton
            paths={SUMMARY_ICON_PATHS}
            label="Zusammenfassung"
            onClick={() => setOpen(true)}
          />
          <CollapsedIconButton
            paths={STUDY_GUIDE_ICON_PATHS}
            label="Study Guide & FAQ"
            onClick={() => setOpen(true)}
          />
          <CollapsedIconButton
            paths={MIND_MAP_ICON_PATHS}
            label="Mind Map"
            onClick={() => setOpen(true)}
          />
          <CollapsedIconButton
            paths={AUDIO_OVERVIEW_ICON_PATHS}
            label="Audio Overview"
            onClick={() => setOpen(true)}
          />
        </div>
      )}
    </aside>
  );
}
