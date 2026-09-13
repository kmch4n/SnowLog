/**
 * 写真ライブラリ取得アダプタの共有契約（#86 §4.2）
 *
 * ネイティブ側（`modules/snowlog-media`）と JS 側が唯一共有する形。実装を
 * 持たないので、アダプタが無くても取り込みオーケストレーションを組み立てて
 * 検証できる。
 *
 * `null` を「無関係な複数の事情」の代用にしないこと。取得できなかった理由は
 * 呼び出し側の振る舞いを変える——通信が要るのか、権限が無いのか、消えたのか、
 * ユーザーが止めたのかで、出す UI も再試行の可否も違う。
 */
import type { VideoStorageMode } from "../utils/videoStorageMode";

export type { VideoStorageMode };

/**
 * ユーザーが選ぶ優先軸。**何を節約するか**を表す名前であって、ファイルの
 * 置き場所ではない。
 *
 * - `save_space`: 端末容量を節約する → 行は `reference`
 * - `save_data`: 通信量を節約する → 行は `copy`
 *
 * `app_preferences` に永続化されるので、値の文字列は移行なしに変えられない。
 */
export type MediaPriority = "save_space" | "save_data";

/**
 * このリクエストがネットワークを使ってよいか。
 *
 * 既定値を持たせない。JS/ネイティブ境界で省略を許すと、暗黙に `allow` へ
 * 倒れる経路がいつか生える（#86 §4.2）。
 */
export type MediaNetworkAccess = "deny" | "allow";

/** 取得が成立しなかった理由 */
export type MediaFailureCode =
    | "needs_network"
    | "not_accessible"
    | "missing"
    | "cancelled"
    | "interrupted"
    | "insufficient_space"
    | "unsupported"
    | "source_changed"
    | "timeout"
    | "io_error";

/** PHAsset から読み取れるメタデータ。撮影日は欠けうる */
export interface PhotoVideoMetadata {
    assetId: string;
    filename: string;
    capturedAt: number | null;
    duration: number;
    width: number;
    height: number;
    modificationTime: number | null;
    location: { latitude: number; longitude: number } | null;
}

/** 撮影日を確定させたあとのメタデータ。ジョブに保存するのはこちら */
export type ImportVideoMetadata = Omit<PhotoVideoMetadata, "capturedAt"> & {
    capturedAt: number;
};

/** 取得済みのローカルファイル。`localUri` は必ずアプリ所有のパス */
export type PreparedVideo =
    | {
          kind: "ready";
          requestId: string;
          localUri: string;
          extension: "mov" | "mp4" | "m4v";
          bytes: number;
          duration: number;
          width: number;
          height: number;
      }
    | { kind: "blocked"; code: MediaFailureCode };

/** 進捗。総量が不明なことがあるので `fraction` は null を取る */
export interface MediaProgress {
    requestId: string;
    phase: "acquiring" | "exporting" | "writing" | "verifying";
    fraction: number | null;
    writtenBytes: number;
}

export type PhotoVideoLookup =
    | { kind: "found"; metadata: PhotoVideoMetadata }
    | { kind: "blocked"; code: MediaFailureCode };

export type LocalPoster =
    | { kind: "ready"; localUri: string }
    | { kind: "placeholder" }
    | { kind: "blocked"; code: MediaFailureCode };

/**
 * 取得アダプタ。`photoMediaService` が実装を提供し、オーケストレーションは
 * この形にしか依存しない。
 *
 * インターフェースとして切ってあるのは、ネイティブを持たない環境で取り込みの
 * 手順・状態遷移・巻き戻しを検証するため。偽アダプタは要求されたネットワーク
 * フラグを記録できるので、「ローカル専用のはずの経路が `allow` を渡していないか」
 * をネイティブ抜きで検査できる。
 */
export interface PhotoMediaAdapter {
    readPhotoVideo(assetId: string): Promise<PhotoVideoLookup>;
    preparePhotoVideo(
        assetId: string,
        requestId: string,
        networkAccess: MediaNetworkAccess
    ): Promise<PreparedVideo>;
    requestLocalPoster(assetId: string, requestId: string): Promise<LocalPoster>;
    cancelMediaRequest(requestId: string): Promise<void>;
    releasePreparedMedia(requestId: string): Promise<void>;
}

/**
 * 取得したファイルをアプリ管理下へ確定させる側。
 *
 * ステージングから最終パスへの移動と、失敗時の後片付けを担う。オーケストレー
 * ションからファイルシステムを直接触らせないための境界。
 */
export interface ManagedFileSink {
    /** 空き容量（バイト）。分からなければ null */
    getFreeDiskBytes(): Promise<number | null>;
    /** ステージングのファイルを最終パスへ移す。同一コンテナ内の rename */
    promote(stagedUri: string, relativePath: string): Promise<void>;
    /** 確定していないファイルを消す。失敗しても投げない */
    discard(relativePath: string): Promise<void>;
}
