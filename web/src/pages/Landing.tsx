import { useEffect } from "react";
import { Hero } from "./landing/Hero";
import { ProblemAndPromise } from "./landing/ProblemAndPromise";
import { HowItWorks } from "./landing/HowItWorks";
import { MeetTheFleet } from "./landing/MeetTheFleet";
import { WhatMakesItDifferent } from "./landing/WhatMakesItDifferent";
import { QuickStart } from "./landing/QuickStart";
import { KeyFeatures } from "./landing/KeyFeatures";
import { RoadmapHighlights } from "./landing/RoadmapHighlights";
import { FinalCta } from "./landing/FinalCta";
import { LandingStyles } from "./landing/LandingStyles";

const PAGE_TITLE = "armada — multi-agent software voyages";
const PAGE_DESCRIPTION =
  "armada turns a written contract into a coordinated team of AI agents that build, test, review, and ship software — in parallel, behind phase gates, with evidence at every step.";
const PAGE_URL = "https://rafmacalaba.github.io/armada/";

type MetaName = "description" | "og:title" | "og:description" | "og:type" | "og:url";

function setMeta(name: MetaName, content: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function Landing() {
  useEffect(() => {
    document.title = PAGE_TITLE;
    setMeta("description", PAGE_DESCRIPTION);
    setMeta("og:title", PAGE_TITLE);
    setMeta("og:description", PAGE_DESCRIPTION);
    setMeta("og:type", "website");
    setMeta("og:url", PAGE_URL);
  }, []);

  return (
    <article className="landing">
      <Hero />
      <ProblemAndPromise />
      <HowItWorks />
      <MeetTheFleet />
      <WhatMakesItDifferent />
      <QuickStart />
      <KeyFeatures />
      <RoadmapHighlights />
      <FinalCta />
      <LandingStyles />
    </article>
  );
}
