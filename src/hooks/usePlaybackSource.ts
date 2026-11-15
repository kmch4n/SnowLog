import { useEffect, useRef, useState } from "react";

import { updateFileAvailability } from "@/database/repositories/videoRepository";
import { resolveManagedPath } from "@/services/managedVideoFileService";
import { getAssetInfoWithDownload, requestPhotosAccess } from "@/services/mediaService";
import type { Video } from "@/types";
import { decidePlaybackSource, type PhotosAccess } from "@/utils/playbackSource";

/** 写真ライブラリから読めた動画の寸法と長さ。プレイヤーの高さとメタ行に使う */
export interface PlaybackAssetMeta {
    width: number;
    height: number;
    duration: number;
}

export interface PlaybackSourceState {
    /** 再生する URI。解決中・解決できなかったときは null */
    videoUri: string | null;
    assetInfoMeta: PlaybackAssetMeta | null;
    /** 写真へのアクセスが足りず解決できなかった（#87）。ファイル欠損とは別の表示にする */
    accessBlocked: boolean;
}

type PlaybackFields = Pick<
    Video,
    "id" | "isFileAvailable" | "storageMode" | "managedVideoPath" | "assetId"
>;

/**
 * 動画詳細のプレイヤーに渡す再生元を解決する
 *
 * 解決の結果で `isFileAvailable` を書き換えたら `refresh` を呼んで行を読み直させる。
 * 何を表示し何を書くかの判断は `decidePlaybackSource`（純粋関数・テスト済み）に任せる。
 */
export function usePlaybackSource(
    video: PlaybackFields | null | undefined,
    refresh: () => void
): PlaybackSourceState {
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [assetInfoMeta, setAssetInfoMeta] = useState<PlaybackAssetMeta | null>(null);
    const [accessBlocked, setAccessBlocked] = useState(false);

    // Stable ref so the media-resolution effect can refresh without depending on it
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;

    // Every save refetches the row and hands back a new `video` object. Only the
    // fields below decide what the player plays, so the source is resolved again
    // only when one of them changes — not on every autosave, which would unmount
    // the player and re-request an iCloud asset each time.
    const playbackVideoId = video?.id;
    const playbackIsFileAvailable = video?.isFileAvailable;
    const playbackStorageMode = video?.storageMode;
    const playbackManagedVideoPath = video?.managedVideoPath;
    const playbackAssetId = video?.assetId;

    // 解決結果の判定に使う「いま DB にある値」。effect の依存にすると、解決に成功して
    // 0 → 1 に戻した瞬間に effect が走り直し、プレイヤーを一度消して解決をやり直すため ref で読む
    const wasAvailableRef = useRef(playbackIsFileAvailable === 1);
    wasAvailableRef.current = playbackIsFileAvailable === 1;

    useEffect(() => {
        if (playbackVideoId === undefined || playbackAssetId === undefined) return;
        // 解決が長引く間に再生元が変わったら、古い結果を新しい再生元の上に書かない
        let cancelled = false;
        setVideoUri(null);
        setAssetInfoMeta(null);
        setAccessBlocked(false);

        // 「ファイル無し」（isFileAvailable = 0）の行でも解決を試みる。以前は 1 の行しか
        // 試さなかったので、写真へのアクセスが限定されていた間に 0 になった動画は、
        // フルアクセスに戻しても二度と再生できなかった（#87）。
        (async () => {
            try {
                let uri: string | null = null;
                let meta: PlaybackAssetMeta | null = null;
                // アプリが持つコピーは写真ライブラリを一切見ない。権限が
                // 拒否されていても、元の写真が消えていても再生できる。
                let access: PhotosAccess = "all";

                if (playbackStorageMode === "copy") {
                    // コピーが見つからなくても写真ライブラリへ黙って
                    // フォールバックしない——別物を掴むことになる。
                    uri = playbackManagedVideoPath
                        ? await resolveManagedPath(playbackManagedVideoPath)
                        : null;
                } else {
                    access = await requestPhotosAccess();
                    if (cancelled) return;
                    if (access !== "none") {
                        const info = await getAssetInfoWithDownload(playbackAssetId);
                        if (info?.uri || info?.localUri) {
                            // 再生には Photos フレームワークの uri (ph://) を優先利用する
                            uri = info.uri ?? info.localUri ?? null;
                            meta = { width: info.width, height: info.height, duration: info.duration };
                        }
                    }
                }
                if (cancelled) return;

                const decision = decidePlaybackSource({
                    resolved: uri !== null,
                    access,
                    wasAvailable: wasAvailableRef.current,
                });
                switch (decision.kind) {
                    case "play":
                        // 高さ変更は LAYOUT_SPRING の layout transition が滑らかに遷移させる
                        setVideoUri(uri);
                        if (meta) setAssetInfoMeta(meta);
                        if (decision.markAvailable) {
                            await updateFileAvailability(playbackVideoId, true);
                            refreshRef.current();
                        }
                        return;
                    case "missing":
                        if (decision.markMissing) {
                            await updateFileAvailability(playbackVideoId, false);
                            refreshRef.current();
                        }
                        return;
                    case "notAccessible":
                        // 権限が足りないのは一時的な状態であり、ファイル欠損ではない。
                        // 開くたびにモーダルを出さず、プレイヤーの位置に案内を出す
                        setAccessBlocked(true);
                        return;
                }
            } catch {
                // 一時的エラー（iCloud・ネットワーク等）の可能性があるため
                // DB の isFileAvailable は更新しない
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [playbackVideoId, playbackStorageMode, playbackManagedVideoPath, playbackAssetId]);

    return { videoUri, assetInfoMeta, accessBlocked };
}
