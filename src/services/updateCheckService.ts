import Constants from "expo-constants";

import {
    getPreference,
    setPreference,
} from "@/database/repositories/appPreferenceRepository";
import { isRemoteVersionNewer } from "@/utils/versionUtils";

const APP_STORE_LOOKUP_URL =
    "https://itunes.apple.com/lookup?id=6761445679&country=jp";
const FALLBACK_APP_STORE_URL =
    "https://apps.apple.com/jp/app/snowlog-snow-video-review-app/id6761445679";
const DISMISSED_UPDATE_VERSION_KEY = "dismissed_update_prompt_version";
const REQUEST_TIMEOUT_MS = 5000;

interface AppStoreLookupResult {
    version: string;
    trackViewUrl?: string;
}

interface AppStoreLookupResponse {
    resultCount: number;
    results: AppStoreLookupResult[];
}

export interface OptionalUpdateInfo {
    latestVersion: string;
    appStoreUrl: string;
}

function getCurrentAppVersion(): string | null {
    return Constants.expoConfig?.version ?? null;
}

function isAppStoreLookupResult(value: unknown): value is AppStoreLookupResult {
    if (!value || typeof value !== "object") {
        return false;
    }

    const result = value as Record<string, unknown>;
    return typeof result.version === "string"
        && result.version.trim().length > 0
        && (
            result.trackViewUrl === undefined
            || typeof result.trackViewUrl === "string"
        );
}

function isAppStoreLookupResponse(
    value: unknown
): value is AppStoreLookupResponse {
    if (!value || typeof value !== "object") {
        return false;
    }

    const response = value as Record<string, unknown>;
    return typeof response.resultCount === "number"
        && Array.isArray(response.results)
        && response.results.every(isAppStoreLookupResult);
}

async function fetchAppStoreVersion(): Promise<AppStoreLookupResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(APP_STORE_LOOKUP_URL, {
            cache: "no-store",
            signal: controller.signal,
        });
        if (!response.ok) {
            return null;
        }

        const body: unknown = await response.json();
        if (!isAppStoreLookupResponse(body) || body.resultCount < 1) {
            return null;
        }

        return body.results[0] ?? null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

export async function getOptionalUpdateInfo(): Promise<OptionalUpdateInfo | null> {
    const currentVersion = getCurrentAppVersion();
    if (!currentVersion) {
        return null;
    }

    const appStoreVersion = await fetchAppStoreVersion();
    if (!appStoreVersion) {
        return null;
    }

    const latestVersion = appStoreVersion.version.trim();
    if (!isRemoteVersionNewer(currentVersion, latestVersion)) {
        return null;
    }

    const dismissedVersion = await getPreference(DISMISSED_UPDATE_VERSION_KEY);
    if (dismissedVersion === latestVersion) {
        return null;
    }

    return {
        latestVersion,
        appStoreUrl: appStoreVersion.trackViewUrl?.trim() || FALLBACK_APP_STORE_URL,
    };
}

export async function dismissOptionalUpdatePrompt(
    latestVersion: string
): Promise<void> {
    await setPreference(DISMISSED_UPDATE_VERSION_KEY, latestVersion);
}
