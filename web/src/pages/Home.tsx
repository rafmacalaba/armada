import { useEffect } from "react";
import { Hero } from "./home/Hero";
import { ProblemAndPromise } from "./home/ProblemAndPromise";
import { HowItWorks } from "./home/HowItWorks";
import { MeetTheFleet } from "./home/MeetTheFleet";
import { WhatMakesItDifferent } from "./home/WhatMakesItDifferent";
import { QuickStart } from "./home/QuickStart";
import { KeyFeatures } from "./home/KeyFeatures";
import { RoadmapHighlights } from "./home/RoadmapHighlights";
import { FinalCta } from "./home/FinalCta";
import { LandingStyles } from "./home/LandingStyles";

const PAGE_TITLE = "armada — AI agent fleets that ship software";
const PAGE_DESCRIPTION =
  "armada turns a written contract into a coordinated fleet of AI agents that build, test, review, and ship software, in parallel, behind phase gates, with evidence at every step.";
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

// Home page — top-level marketing surface.
export function Home() {
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
