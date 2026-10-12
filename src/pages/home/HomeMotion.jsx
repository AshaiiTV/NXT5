import { useLanguage } from "../../i18n/useLanguage.js";
import { t } from "../../i18n/translate.js";
import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import { Nxt5Wordmark } from "../../components/brand/BrandAssets.jsx";
import { Button } from "../../components/ui/Core.jsx";
import ProductStory from "./ProductStory.jsx";
import { LegalLinks, PublicTextLink } from "../public/PublicPages.jsx";
import LanguageSwitcher from "../../i18n/LanguageSwitcher.jsx";

function OutlineMark() {
  return (
    <svg
      viewBox="-5 -5 820 246"
      fill="none"
      className="hm-outline"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hm-outline-ink" x1="0" y1="1" x2="1" y2="0">
          <stop stopColor="#67e8f9" stopOpacity=".85" />
          <stop offset=".3" stopColor="#dbeafe" />
          <stop offset=".52" stopColor="#c4b5fd" stopOpacity=".9" />
          <stop offset=".76" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#a78bfa" stopOpacity=".85" />
        </linearGradient>
      </defs>
      <g
        stroke="url(#hm-outline-ink)"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="miter"
      >
        <path d="M8 233 70 37 51 2H129L192 129 235 2H306L235 213H166L112 111 79 207Z" />
        <path d="M312 2H389L433 73 514 2H596L476 111 527 213H447L408 145 329 213H248L366 105Z" />
        <path d="M609 2H809L790 60H725L675 213H598L648 60H546Z" />
      </g>
    </svg>
  );
}

function GlassFallback() {
  return (
    <img
      className="hm-glass-fallback"
      src="/assets/home-motion/glass-poster.webp"
      width="729"
      height="665"
      alt=""
      decoding="async"
      fetchPriority="high"
    />
  );
}

export default function HomeMotion({ navigate }) {
  useLanguage();
  const pageRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const progressRef = useRef(0);
  const motionPositionRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [shortViewport, setShortViewport] = useState(false);
  const [lowGpu, setLowGpu] = useState(false);
  const [motionConfigured, setMotionConfigured] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [motionUnavailable, setMotionUnavailable] = useState(false);
  const reduced = paused || systemReduced || lowGpu || motionUnavailable;

  useEffect(() => {
    if (!pageRef.current || typeof window.matchMedia !== "function") return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setSystemReduced(query.matches);
    query.addEventListener("change", change);
    const shortQuery = matchMedia("(max-height: 600px)");
    const resize = () => setShortViewport(shortQuery.matches);
    shortQuery.addEventListener("change", resize);
    const observer = new MutationObserver(() =>
      setLowGpu(document.documentElement.classList.contains("nxt5-low-gpu")),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    change();
    resize();
    setLowGpu(document.documentElement.classList.contains("nxt5-low-gpu"));
    setMotionConfigured(true);
    return () => {
      query.removeEventListener("change", change);
      shortQuery.removeEventListener("change", resize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!motionConfigured || !pageRef.current || !canvasRef.current || reduced || sceneFailed) return;
    let cancelled = false;
    let scene;
    let intersection;
    let visible = true;
    const visibility = () => scene?.setActive(visible && !document.hidden);
    const move = (event) => {
      if (event.pointerType === "touch") return;
      scene?.setPointer(
        (event.clientX / window.innerWidth) * 2 - 1,
        (event.clientY / window.innerHeight) * 2 - 1,
      );
    };
    const leave = () => scene?.setPointer(0, 0);
    import("./glass-scene.js")
      .then(async ({ createGlassScene }) => {
        if (cancelled) return;
        scene = await createGlassScene({
          canvas: canvasRef.current,
          onReady: () => {
            if (!cancelled) setSceneReady(true);
          },
          onError: () => {
            if (!cancelled) {
              setSceneReady(false);
              setSceneFailed(true);
            }
          },
        });
        if (cancelled) {
          scene?.dispose();
          return;
        }
        sceneRef.current = scene;
        scene?.setProgress(progressRef.current);
        intersection = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          visibility();
        });
        intersection.observe(pageRef.current.querySelector(".hm-journey"));
        document.addEventListener("visibilitychange", visibility);
        pageRef.current.addEventListener("pointermove", move, {
          passive: true,
        });
        pageRef.current.addEventListener("pointerleave", leave);
        visibility();
      })
      .catch(() => {
        if (!cancelled) setSceneFailed(true);
      });
    const page = pageRef.current;
    return () => {
      cancelled = true;
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      page.removeEventListener("pointermove", move);
      page.removeEventListener("pointerleave", leave);
      scene?.dispose();
      sceneRef.current = null;
      setSceneReady(false);
    };
  }, [motionConfigured, reduced, sceneFailed]);

  useEffect(() => {
    const page = pageRef.current;
    if (!motionConfigured || !page) return;
    const header = page.querySelector(".hm-header");
    const logo = page.querySelector(".hm-header-brand");
    const introActions = page.querySelector(".hm-intro-actions");
    const scrollCue = page.querySelector(".hm-scroll-cue");
    const hero = page.querySelector(".hm-journey");
    const updateHeader = () => {
      const bounds = hero.getBoundingClientRect();
      const visible =
        reduced || shortViewport
          ? bounds.bottom < window.innerHeight * 0.55
          : -bounds.top >
            Math.max(1, bounds.height - window.innerHeight) * 0.62;
      header.classList.toggle("is-scrolled", visible);
      logo.inert = !visible;
    };
    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("resize", updateHeader);
    updateHeader();
    if (reduced || shortViewport) {
      introActions.inert = false;
      scrollCue.inert = false;
      progressRef.current = 0;
      sceneRef.current?.setProgress(0);
      return () => {
        window.removeEventListener("scroll", updateHeader);
        window.removeEventListener("resize", updateHeader);
      };
    }
    let cancelled = false;
    let context;
    let refreshFrame;
    let layoutObserver;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        context = gsap.context(() => {
          const driver = { value: 0 };
          const timeline = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.7,
              invalidateOnRefresh: true,
            },
          });
          timeline.to(
            driver,
            {
              value: 1,
              duration: 1,
              onUpdate: () => {
                progressRef.current = driver.value;
                sceneRef.current?.setProgress(driver.value);
                const fading = driver.value > 0.05;
                if (
                  fading &&
                  !introActions.inert &&
                  (introActions.contains(document.activeElement) ||
                    scrollCue === document.activeElement)
                ) {
                  header
                    .querySelector(".hm-demo-link")
                    ?.focus({ preventScroll: true });
                }
                introActions.inert = fading;
                scrollCue.inert = fading;
              },
            },
            0,
          );
          timeline.to(
            ".hm-outline-wrap",
            {
              xPercent: -12,
              yPercent: -28,
              scale: 1.12,
              opacity: 0,
              duration: 0.47,
            },
            0.08,
          );
          timeline.to(
            ".hm-glass-wrap",
            {
              xPercent: 8,
              yPercent: -6,
              scale: 1.17,
              opacity: 0.16,
              duration: 0.6,
            },
            0.25,
          );
          timeline.to(
            ".hm-atmosphere",
            { scale: 1.17, yPercent: -7, duration: 1 },
            0,
          );
          timeline.to(
            ".hm-clouds-front",
            { scale: 1.2, yPercent: -12, opacity: 0, duration: 0.7 },
            0.1,
          );
          timeline.to(
            ".hm-intro, .hm-scroll-cue",
            { opacity: 0, y: -35, duration: 0.2 },
            0.05,
          );
          timeline.fromTo(
            ".hm-manifesto-line",
            { yPercent: 108, opacity: 0 },
            { yPercent: 0, opacity: 1, stagger: 0.075, duration: 0.24 },
            0.34,
          );
          timeline.fromTo(
            ".hm-manifesto-note",
            { y: 12, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.18 },
            0.65,
          );
          timeline.to(
            ".hm-cinematic-shade",
            { opacity: 0.88, duration: 0.4 },
            0.3,
          );
          gsap.fromTo(
            ".ps-chapter-panel",
            { y: 38 },
            {
              y: 0,
              ease: "none",
              scrollTrigger: {
                trigger: ".ps-chapter-panel",
                start: "top 95%",
                end: "top 40%",
                scrub: 0.5,
              },
            },
          );
          gsap.fromTo(
            ".ps-team-connections path",
            { strokeDasharray: 1, strokeDashoffset: 1 },
            {
              strokeDashoffset: 0,
              ease: "none",
              stagger: 0.04,
              scrollTrigger: {
                trigger: ".ps-team-scene",
                start: "top 90%",
                end: "top 40%",
                scrub: 0.5,
              },
            },
          );
          gsap.fromTo(
            ".ps-final-track",
            { xPercent: 12 },
            {
              xPercent: 0,
              ease: "none",
              scrollTrigger: {
                trigger: ".ps-final",
                start: "top bottom",
                end: "top 45%",
                scrub: 0.7,
              },
            },
          );
        }, page);
        layoutObserver = new ResizeObserver(() => {
          cancelAnimationFrame(refreshFrame);
          refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
        });
        layoutObserver.observe(page);
        refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
      })
      .catch(() => {
        if (!cancelled) setMotionUnavailable(true);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(refreshFrame);
      layoutObserver?.disconnect();
      context?.revert();
      introActions.inert = false;
      scrollCue.inert = false;
      window.removeEventListener("scroll", updateHeader);
      window.removeEventListener("resize", updateHeader);
    };
  }, [motionConfigured, reduced, shortViewport]);

  useEffect(() => {
    const position = motionPositionRef.current;
    if (!position) return;
    motionPositionRef.current = null;
    const frame = requestAnimationFrame(() => {
      if (!position.anchor.isConnected) return;
      window.scrollBy({
        top: position.anchor.getBoundingClientRect().top - position.top,
        behavior: "instant",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  function toggleMotion() {
    const page = pageRef.current;
    const anchor = [
      ...page.querySelectorAll(".ps-product, .ps-team, .ps-final, .hm-footer, .nxt5-footer"),
    ].find((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.bottom > 110 && bounds.top < window.innerHeight;
    });
    motionPositionRef.current = anchor
      ? { anchor, top: anchor.getBoundingClientRect().top }
      : { anchor: page.querySelector(".hm-journey"), top: 0 };
    setPaused((value) => !value);
  }

  function jumpToTools(event) {
    event.preventDefault();
    const tools = document.getElementById("outils");
    tools.focus({ preventScroll: true });
    tools.scrollIntoView({
      behavior: reduced ? "instant" : "smooth",
      block: "start",
    });
  }

  return (
    <div
      ref={pageRef}
      className={`hm-page${reduced ? " hm-reduced" : ""}${shortViewport ? " hm-short" : ""}`}
    >
      <a className="hm-skip" href="#outils" onClick={jumpToTools}>
        {t("Passer l’introduction")}
      </a>
      <header className="hm-header">
        <a
          href="#accueil"
          className="hm-header-brand"
          aria-label={t("NXT5 — retour à l’accueil")}
          inert
        >
          <Nxt5Wordmark loading="eager" />
        </a>
        <nav aria-label={t("Navigation principale")}>
          <a href="#outils" onClick={jumpToTools} className="hm-nav-features">
            {t("Fonctionnalités")}
          </a>
          <PublicTextLink href="/connexion" navigate={navigate}>{t("Connexion")}</PublicTextLink>
          <PublicTextLink href="/demo" navigate={navigate} className="hm-demo-link">
            {t("Essayer la démo")} <ArrowUpRight aria-hidden="true" size={17} />
          </PublicTextLink>
          <LanguageSwitcher />
        </nav>
      </header>
      <main>
        <section id="accueil" className="hm-journey" aria-labelledby="home-title">
          <div className="hm-sticky">
            <div className="hm-atmosphere" aria-hidden="true" />
            <div className="hm-horizon" aria-hidden="true" />
            <div className="hm-outline-wrap">
              <OutlineMark />
            </div>
            <div
              className={`hm-glass-wrap${sceneReady ? " is-ready" : ""}`}
              aria-hidden="true"
            >
              <GlassFallback />
              <canvas ref={canvasRef} className="hm-canvas" />
            </div>
            <div className="hm-clouds-front" aria-hidden="true" />
            <div className="hm-ground-shade" aria-hidden="true" />
            <div className="hm-cinematic-shade" aria-hidden="true" />
            <div className="hm-intro">
              <div>
                <p className="hm-signature">{t("Joue. Analyse. Recommence.")}</p>
                <h1 id="home-title">
                  {t("Comprends tes parties.")}
                  <br />
                  {t("Prépare la suite.")}
                </h1>
              </div>
              <div className="hm-intro-actions">
                <PublicTextLink className="hm-primary" href="/creer-un-compte" navigate={navigate}>
                  {t("Créer mon espace")} <ArrowUpRight aria-hidden="true" />
                </PublicTextLink>
                <p>{t("Pour les équipes League of Legends.")}</p>
              </div>
            </div>
            <a
              href="#outils"
              className="hm-scroll-cue"
              aria-label={t("Découvrir NXT5")}
              onClick={jumpToTools}
            >
              <ArrowDown aria-hidden="true" size={23} />
              <span>{t("Découvre la suite")}</span>
            </a>
            <div className="hm-manifesto" aria-hidden={!reduced}>
              <p>
                <span className="hm-manifesto-row">
                  <span className="hm-manifesto-line">{t("Joue.")}</span>
                </span>
                <span className="hm-manifesto-row">
                  <span className="hm-manifesto-line">{t("Analyse.")}</span>
                </span>
                <span className="hm-manifesto-row">
                  <span className="hm-manifesto-line hm-manifesto-last">
                    {t("Recommence.")}
                  </span>
                </span>
              </p>
              <div className="hm-manifesto-note">
                {t("Chaque partie laisse des questions.")}
                <br />
                {t("Construisez les réponses ensemble.")}
              </div>
            </div>
          </div>
        </section>

        <ProductStory reduced={reduced || shortViewport} navigate={navigate} />
      </main>
      <div className="hm-footer">
        <Nxt5Wordmark />
        <p>{t("Joue. Analyse. Recommence.")}</p>
        <PublicTextLink href="/contact" navigate={navigate}>{t("Contact")}</PublicTextLink>
      </div>
      <LegalLinks navigate={navigate} />
      <Button
        className="hm-motion-toggle"
        variant="ghost"
        aria-pressed={paused}
        onClick={toggleMotion}
        disabled={systemReduced || lowGpu || motionUnavailable}
        icon={reduced ? Play : Pause}
      >
        {systemReduced || lowGpu || motionUnavailable
          ? t("Mouvement réduit")
          : paused
            ? t("Activer les animations")
            : t("Réduire les animations")}
      </Button>
    </div>
  );
}
