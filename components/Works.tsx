"use client";
import { useState } from "react";
import type { Category, Work } from "@/lib/content";

export interface WorkView extends Pick<Work, "id" | "category" | "video" | "poster"> { title: string; desc: string; tag: string }

/** v5 placeholder behavior: clicking the cover reveals the stack. The countdown/explosion effect is v7. */
export default function Works({ category, label, cta, liveTag, works }: { category: Pick<Category, "id">; label: string; cta: string; liveTag: string; works: WorkView[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="category-section" data-cat={category.id}>
      {!open && (
        <div className="category-cover" data-cat={category.id} style={{ minHeight: "50vh" }} onClick={() => setOpen(true)}>
          <div className="explosion-flash" /><div className="explosion-particles" /><canvas className="explosion-3d" />
          <div className="cat-countdown" /><div className="cat-bomb">💣</div>
          <div className="cat-cover-label">{label}</div><div className="cat-cover-cta">{cta}</div>
        </div>
      )}
      <div className="project-stack category-projects" data-cat={category.id} style={{ display: open ? "" : "none" }}>
        {works.map((w, i) => (
          <div className="stack-card" key={w.id} style={{ top: 96, zIndex: i + 1 }}>
            <div className="project-row">
              <span className="project-num mono">{String(i + 1).padStart(2, "0")}</span>
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
