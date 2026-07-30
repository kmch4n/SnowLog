import type { ImageMetadata } from "astro";

export interface NavContent {
    homeAria: string;
    homeHref: string;
    appStoreAria: string;
}

export interface HeroContent {
    eyebrow: string;
    titleLines: string[];
    lead: string;
    appStoreAria: string;
    note: string;
}

export interface VideoContent {
    eyebrow: string;
    title: string;
    ariaLabel: string;
}

export interface StatItem {
    value: string;
    label: string;
}

export interface ProblemItem {
    title: string;
    body: string;
}

export interface SectionCardsContent {
    eyebrow: string;
    title: string;
    items: ProblemItem[];
}

export interface ProblemContent {
    eyebrow: string;
    titleLines: string[];
    items: ProblemItem[];
}

export interface ScreenshotItem {
    src: ImageMetadata;
    alt: string;
    title: string;
    body: string;
}

export interface ScreenshotContent {
    eyebrow: string;
    titleLines: string[];
    items: ScreenshotItem[];
}

export interface PrivacyPanelContent {
    eyebrow: string;
    title: string;
    body: string;
    listAria: string;
    items: string[];
    cta: string;
}

export interface FaqItem {
    question: string;
    answer: string;
}

export interface FaqContent {
    eyebrow: string;
    title: string;
    items: FaqItem[];
}

export interface FooterContent {
    ariaLabel: string;
    appStore: string;
    github: string;
    privacy: string;
}

export interface HomeContent {
    title: string;
    description: string;
    nav: NavContent;
    hero: HeroContent;
    video: VideoContent;
    statsAria: string;
    stats: StatItem[];
    problem: ProblemContent;
    features: SectionCardsContent;
    screenshots: ScreenshotContent;
    privacyPanel: PrivacyPanelContent;
    faq: FaqContent;
    footer: FooterContent;
}

export interface PrivacySection {
    title: string;
    paragraphs?: string[];
    items?: string[];
}

export interface PrivacyContent {
    title: string;
    description: string;
    heading: string;
    eyebrow: string;
    lastUpdatedLabel: string;
    lastUpdated: string;
    contactLinkLabel: string;
    nav: NavContent;
    sections: PrivacySection[];
    footer: FooterContent;
}

export const appStoreUrl = "https://apps.apple.com/jp/app/snowlog-snow-video-review-app/id6761445679";
export const githubUrl = "https://github.com/kmch4n/SnowLog";

export const homePath = "/";
export const privacyPath = "/privacy/";
