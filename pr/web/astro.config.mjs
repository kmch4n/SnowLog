import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
    site: "https://snowlog.kmchan.jp",
    devToolbar: {
        enabled: false,
    },
    output: "static",
    // The site served /ja/ and /en/ until it became Japanese-only.
    redirects: {
        "/ja": "/",
        "/ja/privacy": "/privacy/",
        "/en": "/",
        "/en/privacy": "/privacy/",
    },
    integrations: [sitemap()],
});
