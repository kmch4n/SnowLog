import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
    site: "https://snowlog.kmchan.jp",
    devToolbar: {
        enabled: false,
    },
    output: "static",
    integrations: [sitemap()],
});
