import type { FilterOptions } from "@/types";

export interface SearchRouteParams {
    skiResortName?: string;
    dateFrom?: string;
    dateTo?: string;
    searchText?: string;
    tagIds?: string;
    favoritesOnly?: string;
    requestKey?: string;
}

type ParamValue = string | string[] | undefined;

function readFirst(value: ParamValue): string | undefined {
    if (Array.isArray(value)) {
        return value[0];
    }

    return value;
}

function parseNumber(value: ParamValue): number | undefined {
    const raw = readFirst(value);
    if (!raw) return undefined;

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: ParamValue): boolean | undefined {
    const raw = readFirst(value);
    if (raw == null) return undefined;

    return raw === "true";
}

function parseTagIds(value: ParamValue): number[] | undefined {
    const raw = readFirst(value);
    if (!raw) return undefined;

    const parsed = raw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((part) => Number.isFinite(part));

    return parsed.length > 0 ? parsed : undefined;
}

export function buildSearchRouteParams(filter: FilterOptions): SearchRouteParams {
    return {
        skiResortName: filter.skiResortName,
        dateFrom: filter.dateFrom != null ? String(filter.dateFrom) : undefined,
        dateTo: filter.dateTo != null ? String(filter.dateTo) : undefined,
        searchText: filter.searchText,
        tagIds: filter.tagIds != null && filter.tagIds.length > 0
            ? filter.tagIds.join(",")
            : undefined,
        favoritesOnly: filter.favoritesOnly != null ? String(filter.favoritesOnly) : undefined,
        requestKey: String(Date.now()),
    };
}

export function parseSearchRouteParams(
    params: Record<string, ParamValue>
): FilterOptions | null {
    const filter: FilterOptions = {
        skiResortName: readFirst(params.skiResortName),
        dateFrom: parseNumber(params.dateFrom),
        dateTo: parseNumber(params.dateTo),
        searchText: readFirst(params.searchText),
        tagIds: parseTagIds(params.tagIds),
        favoritesOnly: parseBoolean(params.favoritesOnly),
    };

    const hasAnyValue = Object.values(filter).some((value) => {
        if (Array.isArray(value)) {
            return value.length > 0;
        }

        return value !== undefined;
    });

    return hasAnyValue ? filter : null;
}
