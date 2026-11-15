// STATUS: UNVERIFIED (GPT draft)
"use client";

import { useEffect, useRef } from "react";
import { mountSpotlight } from "@/lib/spotlight-ui";
import type { DotEl, TouchTargetLike, WinLike } from "@/lib/spotlight-ui/contract";

export interface TestimonialItem {
  id: string;
  text: string;
  name: string;
  role: string;
  initials: string;
}

export interface TestimonialsProps {
  heading: string;
  items: TestimonialItem[];
  dotLabelTemplate: string;
}

export default function Testimonials(props: TestimonialsProps) {
  const { heading, items, dotLabelTemplate } = props;

  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sectionEl = sectionRef.current;
    const trackEl = trackRef.current;
    const dotsEl = dotsRef.current;

    if (!sectionEl || !trackEl || !dotsEl || !trackEl.parentElement) {
      return;
    }

    const cards = Array.from(
      trackEl.querySelectorAll<HTMLElement>(".testi-card")
    );

    return mountSpotlight({
      win: window as unknown as WinLike,
      section: sectionEl,
      cards,
      touchTarget: trackEl.parentElement as unknown as TouchTargetLike,
      dots: {
        create: () => document.createElement("button") as unknown as DotEl,
        add: (d) => dotsEl.appendChild(d as unknown as Node),
        remove: (d) => (d as unknown as ChildNode).remove(),
      },
      dotLabel: (i) => dotLabelTemplate.replace("{n}", String(i + 1)),
    });
  }, [items.length, dotLabelTemplate]);

  return (
    <section
      className="testimonials-scroll"
      id="testimonialsScroll"
      ref={sectionRef}
    >
      <div className="testimonials-sticky">
        <div className="section-head reveal center-head">
          <h2>
            {heading} <span className="heart-emoji">🥰</span>
          </h2>
        </div>

        <div className="spotlight-stage">
          <div
            className="spotlight-track"
            id="spotlightTrack"
            ref={trackRef}
          >
            {items.map((item) => (
              <article className="testi-card" key={item.id}>
                <p>{item.text}</p>
                <div className="testi-mini-who">
                  <span className="testi-avatar">{item.initials}</span>
                  <div>
                    <b>{item.name}</b>
                    <span>{item.role}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div
          className="spotlight-dots"
          id="spotlightDots"
          ref={dotsRef}
        />
      </div>
    </section>
  );
}
