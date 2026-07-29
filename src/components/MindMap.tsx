"use client";

import { useEffect, useRef, useState } from "react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { Dialog } from "@/components/Dialog";
import { FALLBACK_MODEL_NOTICE } from "@/lib/modelFallback";

// Leerer Plugin-Satz: die eingebauten markmap-lib-Plugins (KaTeX, Highlight.js,
// Checkboxen, ...) ziehen zusaetzliche Abhaengigkeiten nach sich, die fuer
// eine reine Stichpunkt-Gliederung nicht gebraucht werden.
const transformer = new Transformer([]);

// Eigene Markmap-Instanz pro Ansicht (Sidebar-Vorschau vs. Vollbild-Dialog),
// per `key` beim Aendern des Markdowns neu gemountet -- einfacher als eine
// gemeinsame Instanz per setData() zu synchronisieren, und Regenerieren ist
// selten genug, dass der Remount-Overhead nicht ins Gewicht faellt.
function MindMapSvg({ markdown, heightClass }: { markdown: string; heightClass: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const { root } = transformer.transform(markdown);
    markmapRef.current = Markmap.create(svgRef.current, undefined, root);
    // autoFit ist in markmap-view standardmaessig aus; ohne expliziten
    // fit()-Aufruf bleibt der Baum auf seiner unskalierten Rohgroesse. Ein
    // Reflow-Tick Verzoegerung, damit der Container sein endgueltiges Layout
    // hat, bevor fit() die Skalierung berechnet.
    const timer = setTimeout(() => markmapRef.current?.fit(), 200);
    return () => {
      clearTimeout(timer);
      markmapRef.current?.destroy();
      markmapRef.current = null;
    };
  }, [markdown]);

  return (
    <div
      className={`markmap-dark ${heightClass} w-full overflow-hidden rounded-md border border-divider`}
    >
      <svg ref={svgRef} className="markmap h-full w-full" />
    </div>
  );
}

export function MindMap({
  notebookId,
  hasSources,
  initialMindMap,
}: {
  notebookId: string;
  hasSources: boolean;
  initialMindMap: string | null;
}) {
  const [markdown, setMarkdown] = useState<string | null>(initialMindMap);
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallbackModel, setUsedFallbackModel] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setUsedFallbackModel(false);
    setOpen(true);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/mind-map`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Mind Map konnte nicht generiert werden.");
        return;
      }
      setMarkdown(body.mindMap);
      setUsedFallbackModel(Boolean(body.usedFallbackModel));
    } catch {
      setError("Netzwerkfehler bei der Generierung.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-neutral-300"
          aria-expanded={open}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
            <path d="M17 5a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
            <path d="M17 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
            <path d="M17 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0" />
            <path d="M7 12h5M12 12L17 5M12 12L17 12M12 12L17 19" />
          </svg>
          <h6 className="m-0 text-[13px] tracking-[0.08em] uppercase">Mind Map</h6>
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hasSources || loading}
          className="btn btn-ghost text-[11px]"
        >
          {loading ? "Wird generiert…" : markdown ? "Neu generieren" : "Generieren"}
        </button>
      </div>

      {open && (
        <>
          {!hasSources && (
            <p className="m-0 text-xs text-neutral-500">Erst eine Quelle hochladen.</p>
          )}
          {error && <p className="m-0 text-xs text-danger">{error}</p>}
          {usedFallbackModel && (
            <p className="m-0 mb-1.5 text-xs text-neutral-500">{FALLBACK_MODEL_NOTICE}</p>
          )}
          {!error && hasSources && !markdown && (
            <p className="m-0 text-xs text-neutral-500">Noch keine Mind Map generiert.</p>
          )}
          {markdown && (
            <div className="flex flex-col gap-1.5">
              <MindMapSvg key={markdown} markdown={markdown} heightClass="h-[18rem]" />
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                className="btn btn-secondary self-start text-[11px]"
              >
                Vollbild
              </button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        title="Mind Map"
        className="w-[min(1100px,92vw)]"
      >
        {markdown && (
          <MindMapSvg key={`full-${markdown}`} markdown={markdown} heightClass="h-[75vh]" />
        )}
      </Dialog>
    </div>
  );
}
