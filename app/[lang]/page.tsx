import { Fragment, type CSSProperties } from "react";
import { notFound } from "next/navigation";
import { LANGS, getStore, tr, type Lang, type ContactLink } from "@/lib/content";
import Effects from "@/components/Effects";
import LangSwitch from "@/components/LangSwitch";
import ThemeToggle from "@/components/ThemeToggle";
import ScrollProgress from "@/components/ScrollProgress";
import HeroBackground from "@/components/HeroBackground";
import Works from "@/components/Works";
import WorksPlayback from "@/components/WorksPlayback";
import WorksFillHeading from "@/components/WorksFillHeading";
import HeroFx from "@/components/HeroFx";
import ScrollTimeline from "@/components/ScrollTimeline";
import Testimonials from "@/components/Testimonials";
import BriefDialog from "@/components/BriefDialog";
import ReviewDialog from "@/components/ReviewDialog";
import Interactions from "@/components/Interactions";
import ContactFormHandler from "@/components/ContactFormHandler";
import { SkillIcons, ContactIcons } from "@/components/icons";
import { groupWorks } from "@/lib/works";

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join(".");
const linkHref = (l: ContactLink) =>
  l.id === "whatsapp" ? "https://wa.me/" + l.value.replace(/\D/g, "") : l.id === "email" ? "mailto:" + l.value : l.value;
const LABEL: Record<string, string> = { email: "Email", whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook" };

function Icon({ k }: { k: string }) {
  const i = ContactIcons[k];
  return <svg viewBox={i.viewBox} width={18} height={18}><path fill="currentColor" d={i.d} /></svg>;
}

// M11: content lives in data/content.json and is edited by the API server (server/), so render per request instead of at build time.
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!LANGS.includes(raw as Lang)) notFound();
  const lang = raw as Lang;
  const s = await getStore();
  const [texts, media, paragraphs, stats, skills, cats, works, steps, packages, testi, links] = await Promise.all([
    s.listTexts(), s.listMedia(), s.list("about.paragraphs"), s.list("about.stats"), s.list("skills"),
    s.list("works.categories"), s.list("works"), s.list("process"), s.list("packages"), s.list("testimonials"), s.list("contact.links"),
  ]);
  const [pt, ft, pl, du, bu] = await Promise.all([
    s.list("brief.projectTypes"), s.list("brief.footage"), s.list("brief.platforms"), s.list("brief.durations"), s.list("brief.budgets"),
  ]);
  const t = (k: string) => tr(texts[k], lang);
  const resolved: Record<string, string> = {};
  for (const k of Object.keys(texts)) resolved[k] = t(k);
  const opts = (a: typeof pt) => a.map((o) => ({ id: o.id, value: o.value, label: tr(o.label, lang) }));
  const link = (id: string) => links.find((l) => l.id === id);
  const wa = link("whatsapp")?.value ?? "";
  const logo = media["brand.logo"], photo = media["about.photo"], avatar = media["contact.avatar"];

  return (
    <>
      <div className="cursor-dot" id="cursorDot" />
      <div className="cursor-ring" id="cursorRing" />

      <header className="site-nav">
        <div className="nav-inner">
          <div className="brand nav-brand-anim">
            <span className="brand-logo-mask" role="img" aria-label={logo.alt} style={{ "--logo": `url("${logo.url}")` } as CSSProperties} />
            <span className="brand-name">yossef  <span className="accent-word">salama</span></span>
          </div>
          <nav className="links" id="navLinks">
            <a href="#about">{t("nav.about")}</a>
            <a href="#skills">{t("nav.skills")}</a>
            <a href="#work">{t("nav.work")}</a>
            <a href="#process">{t("nav.process")}</a>
            <a href="#packages">{t("nav.packages")}</a>
            <a href="#contact">{t("nav.contact")}</a>
            <a href="#brief" className="nav-cta" data-open-brief>{t("nav.cta")}</a>
            <LangSwitch lang={lang} labels={{ ar: t("lang.switchTo.ar"), en: t("lang.switchTo.en") }} />
            <ThemeToggle label={t("theme.toggle")} />
          </nav>
          <button className="nav-toggle" id="navToggle" aria-label={t("nav.menu")}>☰</button>
        </div>
      </header>

      <main>
        <section className="brand-splash" dir="ltr">
          <div className="brand-splash-icon" />
          <div className="brand-splash-content">
            <div className="brand-splash-circle"><img src={logo.url} alt={logo.alt} className="brand-splash-circle-logo" /></div>
            <div className="brand-splash-text">
              <div className="brand-splash-title">{t("splash.title")}</div>
              <div className="brand-splash-name">{t("splash.name")}</div>
              <div className="brand-splash-role">{t("splash.role")}</div>
            </div>
          </div>
        </section>

        <section className="hero" id="hero" style={{ borderBottom: "none" }}>
          <div className="hero-bg" aria-hidden="true" />
          <HeroBackground poster={media["hero.poster"]?.url ?? ""} video={media["hero.video"]?.url ?? ""} />
          <div className="hero-inner">
            <div className="eyebrow-role hero-anim" style={{ animationDelay: "0.1s" }}>{t("hero.eyebrow")}</div>
            <h1 className="hero-anim" style={{ animationDelay: "0.2s" }}>{t("hero.title")}</h1>
            <p className="hero-sub hero-anim" style={{ animationDelay: "0.3s" }}>{t("hero.sub")}</p>
            <div className="hero-cta hero-anim" style={{ animationDelay: "0.4s" }}>
              <a href="#work" className="btn btn-primary">{t("hero.cta1")}</a>
              <a href="#brief" className="btn btn-ghost" data-open-brief>{t("hero.cta2")}</a>
            </div>
          </div>
          <HeroFx />
          <div className="timecode-strip hero-anim" style={{ animationDelay: "0.5s" }}>
            <div className="waveform" aria-hidden="true" />
            <div className="tc mono">{t("hero.counter")}</div>
          </div>
        </section>

        <section className="wrap" id="about">
          <div className="about-grid">
            <div className="about-frame reveal">
              <div className="about-bg-text"><div className="abt-ar">{t("about.bgTextAr")}</div><div className="abt-en">{t("about.bgTextEn")}</div></div>
              <div className="about-photo" style={{ backgroundImage: `url("${photo.url}")` }} />
            </div>
            <div className="about-body reveal">
              <div className="about-paras">{paragraphs.map((p) => <p key={p.id}>{tr(p.text, lang)}</p>)}</div>
              <div className="stat-row">{stats.map((x) => <div className="stat reveal" key={x.id}><b>{x.n}</b><span>{tr(x.label, lang)}</span></div>)}</div>
            </div>
          </div>
        </section>

        <section className="wrap" id="skills">
          <div className="section-head reveal"><h2>{t("skills.title")}</h2><div className="idx mono">{t("skills.idx")}</div></div>
          <div className="tools-skill-grid">
            {skills.map((k) => (
              <div className="tool-skill reveal" data-percent={k.percent} key={k.id}>
                <div className={`tool-icon ti-${k.id}`}>{k.icon ? SkillIcons[k.icon] : k.badge}</div>
                <div className="tool-info">
                  <div className="tool-label"><b>{k.name}</b><span className="tool-percent">0%</span></div>
                  <div className="meter"><i style={{ width: "0%" }} /></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="work">
          <div className="wrap">
            <div className="scroll-fill-wrap reveal">
              <div className="scroll-fill-heading" id="portfolioFillHeading">
                <span className="sfh-base">{t("works.heading")}</span><span className="sfh-fill">{t("works.heading")}</span>
              </div>
            </div>
            <div className="section-head reveal"><h2>{t("works.title")}</h2><div className="idx mono">{t("works.idx")}</div></div>
          </div>
          {groupWorks(cats, works).map(({ category: c, items }) => (
            <Works key={c.id} category={c} label={tr(c.label, lang)} cta={tr(c.cta, lang)} liveTag={t("works.liveTag")}
              openLabel={t("works.open")} closeLabel={t("works.close")}
              works={items.map((w) => ({
                id: w.id, category: w.category, video: w.video, poster: w.poster,
                title: tr(w.title, lang), desc: tr(w.desc, lang), tag: tr(w.tag ?? texts["works.tag.default"], lang),
              }))} />
          ))}
          <WorksPlayback />
          <WorksFillHeading />
        </section>

        <section className="wrap" id="process">
          <div className="section-head reveal"><h2>{t("process.title")}</h2><div className="idx mono">{t("process.idx")}</div></div>
          <div className="timeline">
            {steps.map((x, i) => (
              <div className="tl-step reveal" key={x.id}>
                <div className="tl-num"><em>{i + 1}</em></div>
                <div className="tl-body"><h3>{tr(x.title, lang)}</h3><p>{tr(x.text, lang)}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap" id="packages">
          <div className="section-head reveal"><h2>{t("packages.title")}</h2><div className="idx mono">{t("packages.idx")}</div></div>
          <div className="packages-grid reveal">
            {packages.map((x) => (
              <article key={x.id} className="package-card reveal">
                <h3>{tr(x.name, lang)}</h3>
                <div className="package-price">{tr(x.price, lang)}</div>
                <ul className="package-features">
                  {tr(x.features, lang).split("\n").map((f, i) => <li key={i}>{f}</li>)}
                </ul>
                <a href="#brief" className="btn btn-primary" data-open-brief>{t("packages.cta")}</a>
              </article>
            ))}
          </div>
        </section>

        <Testimonials
          heading={t("testimonials.heading")}
          dotLabelTemplate={t("testimonials.dotLabel")}
          items={testi.map((x) => ({
            id: x.id, text: tr(x.text, lang), name: tr(x.name, lang), role: tr(x.role, lang),
            initials: initials(tr(x.name, lang)),
          }))}
        />

        <div className="add-review">
          <p>{t("review.cta.prompt")}</p>
          <button type="button" className="btn btn-ghost" id="openReview">{t("review.cta.button")}</button>
        </div>

        <section className="wrap" id="contact" style={{ borderBottom: "none" }}>
          <div className="contact-grid">
            <div className="contact-info reveal">
              <div className="eyebrow-role">{t("contact.eyebrow")}</div>
              <div className="contact-radial">
                <div className="contact-avatar"><img src={avatar.url} alt="" loading="lazy" decoding="async" /></div>
                {links.map((l, i) => (
                  <div className={`radial-icon pos-${i + 1}`} key={l.id}>
                    <a href={linkHref(l)} {...(l.id === "email" ? {} : { target: "_blank", rel: "noopener" })} title={LABEL[l.id]}>
                      <span className="c-icon" aria-hidden="true"><Icon k={l.id} /></span><span>{LABEL[l.id]}</span>
                    </a>
                  </div>
                ))}
              </div>
              <div className="contact-persona-name center-name">{t("contact.name")}<span>{t("contact.role")}</span></div>
              <button type="button" className="share-btn" id="shareBtn">
                <span className="c-icon" aria-hidden="true"><Icon k="share" /></span><span>{t("contact.share")}</span>
              </button>
            </div>
            <div className="thank-you-block reveal"><div className="ty-title small">{t("contact.thanks").split("\n").map((line, i) => <Fragment key={i}>{i > 0 && <br />}{line}</Fragment>)}</div></div>
          </div>
          <div className="contact-form-wrap">
            <form className="reveal">
              <div className="field"><label htmlFor="name">{t("contactForm.name")}</label><input id="name" type="text" placeholder={t("contactForm.ph.name")} required /></div>
              <div className="field"><label htmlFor="email">{t("contactForm.email")}</label><input id="email" type="email" placeholder={t("contactForm.ph.email")} required /></div>
              <div className="field"><label htmlFor="msg">{t("contactForm.msg")}</label><textarea id="msg" rows={5} placeholder={t("contactForm.ph.msg")} /></div>
              <button type="submit" className="btn btn-primary">{t("contactForm.submit")}</button>
            </form>
          </div>
        </section>
      </main>

      <footer className="wrap">
        <div className="fine" style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="brand-logo-mask sm" role="img" aria-label={t("brand.logoAlt")} style={{ "--logo": `url("${logo.url}")` } as CSSProperties} />{t("footer.copy")}</div>
        <div className="fine mono">{t("footer.tagline")}</div>
      </footer>

      <BriefDialog lang={lang} t={resolved} whatsapp={wa} projectTypes={opts(pt)} footage={opts(ft)} platforms={opts(pl)} durations={opts(du)} budgets={opts(bu)} />
      <ScrollProgress />
      <ScrollTimeline label={t("timeline.label")} items={[{ id: "hero", label: t("timeline.start") }, { id: "about", label: t("nav.about") }, { id: "work", label: t("nav.work") }, { id: "process", label: t("nav.process") }, { id: "packages", label: t("nav.packages") }, { id: "contact", label: t("nav.contact") }]} />
      <ReviewDialog t={resolved} whatsapp={wa} lang={lang} />
      <Interactions t={resolved} />
      <ContactFormHandler t={resolved} />
      <Effects />
    </>
  );
}
