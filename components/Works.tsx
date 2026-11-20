// STATUS: UNVERIFIED (Claude draft; M2/T4; not compiled or rendered on the owner's machine)
"use client";
import { useEffect, useReducer, useRef } from "react";
import type { Category, Work } from "@/lib/content";
import { cardNum, categoryReducer, coverVisible, initialCategoryState } from "@/lib/works";
import { mountBrowserWorksController } from "@/lib/works-ui/dom";
import type { WorksController } from "@/lib/works-ui/controller";
import { emitWorksClose } from "@/lib/works-ui/events";

export interface WorkView extends Pick<Work, "id" | "category" | "video" | "poster"> { title: string; desc: string; tag: string }

/**
 * One category of the works section (v7, T4).
 * - The cover (bomb, countdown, canvas) is mounted only until the category has been opened once (D22).
 * - The list is shown by `open`; Open/Close are explicit controls (D19, D22). Inline styles + existing classes only (D24/D25).
 * - Cards are numbered per category with cardNum (D20).
 * The cover click starts the v4 countdown/explosion through lib/works-ui/controller.ts (M4); the controller dispatches
 * boom / reveal / reset into this reducer. One controller per mount; React cleanup disposes it (StrictMode mounts twice).
 */
export default function Works({ category, label, cta, liveTag, openLabel, closeLabel, works }: {
  category: Pick<Category, "id">; label: string; cta: string; liveTag: string; openLabel: string; closeLabel: string; works: WorkView[];
}) {
  const [state, dispatch] = useReducer(categoryReducer, initialCategoryState);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<WorksController | null>(null);
  const listId = `cat-list-${category.id}`;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const controller = mountBrowserWorksController(section, dispatch);
    controllerRef.current = controller;
    return () => {
      controller?.dispose();
      controllerRef.current = null;
    };
  }, []);

  return (
    <div className="category-section" data-cat={category.id} ref={sectionRef}>
      {coverVisible(state) && (
        <div className="category-cover" data-cat={category.id} style={{ minHeight: "50vh" }} onClick={() => controllerRef.current?.detonate()}>
          <div className="explosion-flash" /><div className="explosion-particles" /><canvas className="explosion-3d" />
          <div className="cat-countdown" /><div className="cat-bomb">💣</div>
          <div className="cat-cover-label">{label}</div><div className="cat-cover-cta">{cta}</div>
        </div>
      )}
      {state.everOpened && (
        <div className="category-controls" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flexWrap: "wrap", padding: "24px 24px 8px" }}>
          <span style={{ color: "var(--text)", fontSize: "1.25rem" }}>{label}</span>
          {state.open ? (
            <button type="button" className="cat-cover-cta" style={{ background: "none", cursor: "pointer" }} aria-expanded="true" aria-controls={listId} onClick={() => { emitWorksClose(window, category.id); dispatch({ type: "close" }); }}>{closeLabel}</button>
          ) : (
            <button type="button" className="cat-cover-cta" style={{ background: "none", cursor: "pointer" }} aria-expanded="false" aria-controls={listId} onClick={() => dispatch({ type: "openNow" })}>{openLabel}</button>
          )}
        </div>
      )}
      <div className="project-stack category-projects" id={listId} data-cat={category.id} style={{ display: state.open ? "" : "none" }}>
        {works.map((w, i) => (
          <div className="stack-card" key={w.id} style={{ top: 96, zIndex: i + 1 }}>
            <div className="project-row">
              <span className="project-num mono">{cardNum(i)}</span>
              <span className="project-title">{w.title}</span>
              <span className="project-tag">{liveTag}</span>
            </div>
            <div className="stack-card-body">
              <div className="native-video-wrap">
                <video controls preload={i === 0 ? "metadata" : "none"} poster={w.poster ?? undefined} playsInline>
                  <source src={w.video} type={w.video.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4"} />
                </video>
              </div>
              <div className="work-info">
                <div><h3>{w.title}</h3><p>{w.desc}</p></div>
                <span className="work-tag">{w.tag}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
