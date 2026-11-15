/**
 * 既定の滑走種別を、起動時にどれだけ追加するか
 *
 * 以前は起動のたびに「既定のうち DB に無い名前」を追加していた。設定で既定の種別を
 * 削除しても、次の起動で戻っていた。いまは追加したことのある既定の名前を
 * `app_preferences.technique_defaults_seeded`（JSON の文字列配列）に残し、各既定は 1 回だけ追加する。
 * 将来のバージョンで既定が増えたときは、その名前だけが追加される。
 *
 * import を持たない。`scripts/tests/` が素の `tsc` でコンパイルできるようにするため。
 */

export const TECHNIQUE_DEFAULTS_SEEDED_KEY = "technique_defaults_seeded";

export interface TechniqueSeedPlan {
    /** 追加する名前（既定の並び順） */
    toInsert: string[];
    /** 追加後に記録する「追加済みの既定」 */
    seeded: string[];
}

/**
 * @param defaults 既定の種別（並び順どおり）
 * @param existingNames いま DB にある種別の名前
 * @param storedSeeded 記録済みの「追加済みの既定」。記録が無い・読めないなら null
 */
export function planTechniqueSeed(
    defaults: readonly string[],
    existingNames: ReadonlySet<string>,
    storedSeeded: readonly string[] | null
): TechniqueSeedPlan {
    if (storedSeeded === null) {
        if (existingNames.size === 0) {
            // 新規インストール: すべて追加する
            return { toInsert: [...defaults], seeded: [...defaults] };
        }
        // 記録を持たない版からの更新。旧版は起動のたびに足りない既定を戻していたので、
        // いま無い既定は直前のセッションで利用者が消したもの。戻さずに追加済みとして記録する
        return { toInsert: [], seeded: [...defaults] };
    }

    const seeded = new Set(storedSeeded);
    const toInsert = defaults.filter((name) => !seeded.has(name) && !existingNames.has(name));
    const merged = [...storedSeeded];
    for (const name of defaults) {
        if (!seeded.has(name)) merged.push(name);
    }
    return { toInsert, seeded: merged };
}

/** 記録の文字列を読む。壊れていたら null（記録なし扱い） */
export function parseSeededTechniqueNames(raw: string | null): string[] | null {
    if (raw === null) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
            return parsed;
        }
    } catch {
        // 下で null を返す
    }
    return null;
}
