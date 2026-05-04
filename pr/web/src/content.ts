import screenshot2 from "./assets/screenshots/screenshot-2.png";
import screenshot3 from "./assets/screenshots/screenshot-3.png";
import screenshot4 from "./assets/screenshots/screenshot-4.png";
import screenshot5 from "./assets/screenshots/screenshot-5.png";
import { localePaths, privacyPaths, type HomeContent, type Locale, type PrivacyContent } from "./i18n";

const navByLocale: Record<Locale, HomeContent["nav"]> = {
    ja: {
        homeAria: "SnowLog home",
        homeHref: localePaths.ja,
        appStoreAria: "App StoreでSnowLogを開く",
        alternateHref: localePaths.en,
        alternateLabel: "EN",
        alternateAria: "Open English page",
    },
    en: {
        homeAria: "SnowLog home",
        homeHref: localePaths.en,
        appStoreAria: "Open SnowLog on the App Store",
        alternateHref: localePaths.ja,
        alternateLabel: "JA",
        alternateAria: "日本語ページを開く",
    },
};

const footerByLocale: Record<Locale, HomeContent["footer"]> = {
    ja: {
        ariaLabel: "Footer navigation",
        appStore: "App Store",
        privacy: "Privacy",
        support: "Contact",
    },
    en: {
        ariaLabel: "Footer navigation",
        appStore: "App Store",
        privacy: "Privacy",
        support: "Contact",
    },
};

export const homeContent: Record<Locale, HomeContent> = {
    ja: {
        locale: "ja",
        lang: "ja",
        path: localePaths.ja,
        title: "SnowLog - Snow Video Review App",
        description:
            "SnowLogは、スキー・スノーボードの滑走動画をゲレンデ、技術、日付で整理して振り返るためのiOSアプリです。",
        ogLocale: "ja_JP",
        nav: navByLocale.ja,
        hero: {
            eyebrow: "Snow Video Review App",
            titleLines: ["滑走動画を、あとから", "探せる練習ログへ。"],
            lead: "SnowLogは、スキー・スノーボードの動画をゲレンデ、技術、日付で整理して振り返るためのiOSアプリです。",
            appStoreAria: "App StoreでSnowLogをダウンロード",
            note: "iOS向け / オフラインファースト / 日本語・英語対応",
        },
        statsAria: "SnowLogの主要スペック",
        stats: [
            { value: "378", label: "収録ゲレンデ" },
            { value: "無料", label: "App Store配布" },
            { value: "iOS 16+", label: "対応OS" },
            { value: "ja / en", label: "対応言語" },
        ],
        problem: {
            eyebrow: "Why SnowLog",
            titleLines: ["写真アプリだけでは、", "滑りは振り返りづらい。"],
            items: [
                {
                    title: "撮影日だけでは探せない",
                    body: "「あの日のゲレンデ」「この種目の一本」を見返したいとき、写真アプリの時系列だけではすぐに辿り着けません。",
                },
                {
                    title: "練習の文脈が残りにくい",
                    body: "動画、メモ、技術、雪質、日記が別々になると、次の練習につながる振り返りが途切れてしまいます。",
                },
                {
                    title: "動画は重く、扱いにくい",
                    body: "滑走動画は容量が大きいため、整理のためだけに二重保存すると端末ストレージを圧迫します。",
                },
            ],
        },
        features: {
            eyebrow: "Features",
            title: "滑りを整理しやすく。",
            items: [
                {
                    title: "ゲレンデ別に整理",
                    body: "GPS情報から日本のゲレンデを推定し、動画を滑った場所ごとにまとめられます。",
                },
                {
                    title: "技術・タグ・メモ",
                    body: "大回り、小回り、フリー滑走など、動画に練習内容を紐づけて残せます。",
                },
                {
                    title: "カレンダーと日記",
                    body: "滑った日ごとに動画と日記を見返し、天候や雪質、感想まで記録できます。",
                },
                {
                    title: "検索と統計",
                    body: "タイトルやメモから探し、シーズンやゲレンデ単位の振り返りにも使えます。",
                },
                {
                    title: "一括インポート",
                    body: "複数の滑走動画をまとめて取り込み、進行状況を見ながら整理を進められます。",
                },
                {
                    title: "iCloud動画にも対応",
                    body: "端末に未ダウンロードの動画も、取り込み時に必要に応じて取得します。",
                },
            ],
        },
        screenshots: {
            eyebrow: "Screens",
            titleLines: ["撮ったあとに、", "ちゃんと見返せる画面。"],
            items: [
                {
                    src: screenshot2,
                    alt: "ゲレンデごとに滑走動画を一覧できるSnowLogのホーム画面",
                    title: "ホーム",
                    body: "ゲレンデ別の一覧から、お気に入りや滑走種別を手がかりに動画へ戻れます。",
                },
                {
                    src: screenshot3,
                    alt: "動画とゲレンデ、滑走種別、タグ、メモを編集できるSnowLogの動画詳細画面",
                    title: "動画詳細",
                    body: "動画ごとにゲレンデ、滑走種別、タグ、自分だけのメモを残せます。",
                },
                {
                    src: screenshot4,
                    alt: "滑走日数や動画数、ゲレンデランキング、テクニック分布を確認できるSnowLogのダッシュボード画面",
                    title: "ダッシュボード",
                    body: "動画数、滑走日数、ゲレンデ、テクニックの傾向をシーズン単位で見返せます。",
                },
                {
                    src: screenshot5,
                    alt: "日付ごとの滑走記録とメモを確認できるSnowLogのカレンダー画面",
                    title: "カレンダー",
                    body: "滑った日、天気、メモ、その日の動画を月ごとに振り返れます。",
                },
            ],
        },
        privacyPanel: {
            eyebrow: "Offline First",
            title: "動画を増やすほど効いてくる、端末内整理。",
            body: "SnowLogはクラウド同期を前提にせず、動画の情報を端末内で管理します。大容量の滑走動画を整理のためだけに複製しないため、撮影本数が増えても運用しやすい設計です。",
            listAria: "SnowLogのデータ管理方針",
            items: [
                "動画本体は写真ライブラリを参照",
                "メモやタグは端末内に保存",
                "ゲレンデでも使いやすいローカル中心設計",
            ],
            cta: "App Storeで見る",
        },
        faq: {
            eyebrow: "FAQ",
            title: "よくある質問",
            items: [
                {
                    question: "対応プラットフォームは？",
                    answer: "現在はiOS向けにApp Storeで配布しています。Android版は将来的な検討対象ですが、リリース予定は未定です。",
                },
                {
                    question: "料金はかかりますか？",
                    answer: "無料でご利用いただけます。アプリ内課金や広告はありません。",
                },
                {
                    question: "対応iOSバージョンは？",
                    answer: "iOS 16以上で動作します。最新版iOSでの利用を推奨しています。",
                },
                {
                    question: "iCloud上の動画も取り込めますか？",
                    answer: "端末に未ダウンロードの動画も、取り込み時に必要に応じて取得する設計です。Wi-Fi環境での操作を推奨します。",
                },
                {
                    question: "動画はアプリ内にコピーされますか？",
                    answer: "基本的には写真ライブラリの動画を参照し、整理に必要な情報（タイトル、メモ、タグ、サムネイルなど）のみをSnowLog側で管理します。",
                },
                {
                    question: "データは外部に送信されますか？",
                    answer: "すべて端末内で完結します。サーバー同期やアナリティクスSDKは組み込まれておらず、メモやタグも端末外には出ません。",
                },
                {
                    question: "機種変更時にデータは引き継がれますか？",
                    answer: "アプリ内設定からJSON形式でエクスポートし、新しい端末で読み込む形を想定しています。スムーズな移行のための機能改善は継続中です。",
                },
                {
                    question: "英語表示に対応していますか？",
                    answer: "日本語と英語の表示に対応しています。端末の言語設定に追従するほか、設定 > 言語からアプリ内で切り替えできます。",
                },
            ],
        },
        footer: footerByLocale.ja,
    },
    en: {
        locale: "en",
        lang: "en",
        path: localePaths.en,
        title: "SnowLog - Snow Video Review App",
        description:
            "SnowLog is an iOS app for organizing and reviewing ski and snowboard videos by resort, technique, and date.",
        ogLocale: "en_US",
        nav: navByLocale.en,
        hero: {
            eyebrow: "Snow Video Review App",
            titleLines: ["Turn slope videos into", "a practice log."],
            lead: "SnowLog helps skiers and snowboarders organize videos by resort, technique, and date, so every run is easier to review later.",
            appStoreAria: "Download SnowLog on the App Store",
            note: "For iOS / Offline-first / Japanese and English",
        },
        statsAria: "Key SnowLog specs",
        stats: [
            { value: "378", label: "Japanese resorts" },
            { value: "Free", label: "on the App Store" },
            { value: "iOS 16+", label: "supported OS" },
            { value: "ja / en", label: "languages" },
        ],
        problem: {
            eyebrow: "Why SnowLog",
            titleLines: ["Photos alone", "do not remember your runs."],
            items: [
                {
                    title: "Date order is not enough",
                    body: "When you want to find a specific resort, drill, or run, the Photos timeline is not built for ski practice review.",
                },
                {
                    title: "Practice context gets lost",
                    body: "Videos, notes, snow conditions, and diary entries lose value when they live in separate places.",
                },
                {
                    title: "Videos are heavy",
                    body: "Snow videos take space quickly, so organization should not require another copy of every file.",
                },
            ],
        },
        features: {
            eyebrow: "Features",
            title: "Built for reviewing runs.",
            items: [
                {
                    title: "Organize by resort",
                    body: "SnowLog estimates Japanese ski resorts from GPS metadata and groups videos by where you rode.",
                },
                {
                    title: "Techniques, tags, notes",
                    body: "Attach carving, short turns, free runs, custom tags, and personal notes to each video.",
                },
                {
                    title: "Calendar and diary",
                    body: "Review each ski day with videos, weather, snow quality, impressions, and diary details.",
                },
                {
                    title: "Search and stats",
                    body: "Search titles and notes, then look back by season, resort, and technique trends.",
                },
                {
                    title: "Bulk import",
                    body: "Import multiple slope videos at once and keep organizing while progress is visible.",
                },
                {
                    title: "iCloud video support",
                    body: "Videos that are not yet downloaded to the device can be fetched during import when needed.",
                },
            ],
        },
        screenshots: {
            eyebrow: "Screens",
            titleLines: ["Review what you shot", "without losing context."],
            items: [
                {
                    src: screenshot2,
                    alt: "SnowLog home screen listing slope videos grouped by resort",
                    title: "Home",
                    body: "Return to videos by resort, favorites, and technique labels.",
                },
                {
                    src: screenshot3,
                    alt: "SnowLog video detail screen for editing resort, technique, tags, and notes",
                    title: "Video detail",
                    body: "Keep resort, technique, tags, and private notes attached to each run.",
                },
                {
                    src: screenshot4,
                    alt: "SnowLog dashboard screen showing ski days, videos, resort rankings, and technique distribution",
                    title: "Dashboard",
                    body: "Review ski days, video counts, resort rankings, and technique trends by season.",
                },
                {
                    src: screenshot5,
                    alt: "SnowLog calendar screen showing daily slope records and videos",
                    title: "Calendar",
                    body: "Look back at each day with weather, notes, and the videos from that session.",
                },
            ],
        },
        privacyPanel: {
            eyebrow: "Offline First",
            title: "Local organization that scales with your videos.",
            body: "SnowLog manages video information on your device instead of relying on cloud sync. It references large videos in your photo library rather than duplicating them just for organization.",
            listAria: "SnowLog data handling principles",
            items: [
                "Video files stay in your photo library",
                "Notes and tags are stored on device",
                "Designed to work well around the slopes",
            ],
            cta: "View on the App Store",
        },
        faq: {
            eyebrow: "FAQ",
            title: "Questions",
            items: [
                {
                    question: "Which platforms are supported?",
                    answer: "SnowLog is currently distributed on the App Store for iOS. An Android version may be considered in the future, but there is no release schedule.",
                },
                {
                    question: "Is SnowLog free?",
                    answer: "Yes. SnowLog is free to use and does not include ads or in-app purchases.",
                },
                {
                    question: "Which iOS versions are supported?",
                    answer: "SnowLog supports iOS 16 and later. Using the latest iOS version is recommended.",
                },
                {
                    question: "Can SnowLog import videos stored only in iCloud?",
                    answer: "SnowLog is designed to fetch videos during import when they are not yet downloaded to the device. Wi-Fi is recommended.",
                },
                {
                    question: "Does SnowLog copy videos into the app?",
                    answer: "In general, SnowLog references videos in the photo library and manages only the information needed for review, such as titles, notes, tags, and thumbnails.",
                },
                {
                    question: "Is data sent outside my device?",
                    answer: "No. SnowLog works locally and does not include server sync or analytics SDKs.",
                },
                {
                    question: "Can I migrate data to a new device?",
                    answer: "SnowLog is designed around JSON export and import from the app settings. Migration improvements are ongoing.",
                },
                {
                    question: "Does SnowLog support English?",
                    answer: "Yes. SnowLog supports Japanese and English, following the device language or the in-app language setting.",
                },
            ],
        },
        footer: footerByLocale.en,
    },
};

export const privacyContent: Record<Locale, PrivacyContent> = {
    ja: {
        locale: "ja",
        lang: "ja",
        path: privacyPaths.ja,
        title: "プライバシーポリシー - SnowLog",
        description:
            "SnowLogのプライバシーポリシー。SnowLogが扱うデータの種類、保存場所、第三者提供の有無について説明します。",
        heading: "プライバシーポリシー",
        eyebrow: "Privacy Policy",
        lastUpdatedLabel: "最終更新日",
        lastUpdated: "2026-05-04",
        contactRevealLabel: "連絡先を表示",
        nav: {
            ...navByLocale.ja,
            alternateHref: privacyPaths.en,
            alternateLabel: "EN",
        },
        sections: [
            {
                title: "はじめに",
                paragraphs: [
                    "SnowLog（以下「本アプリ」）は、Kotaro Sasagawa（以下「開発者」）が個人で開発・提供するiOS向けアプリケーションです。本ポリシーは、本アプリが扱うデータの種類、保存場所、利用目的を明らかにします。",
                ],
            },
            {
                title: "収集するデータ",
                paragraphs: [
                    "本アプリは、開発者または第三者のサーバーに利用者のデータを送信しません。以下の情報は、すべて利用者の端末内にのみ保存されます。",
                ],
                items: [
                    "動画ファイルへの参照情報（写真ライブラリのアセットID、ファイル名、撮影日時、サムネイル）",
                    "利用者が手入力したメモ、タイトル、タグ、テクニック、お気に入り情報",
                    "日記エントリ（ゲレンデ、天候、雪質、感想、気温、同行者、疲労度、費用、本数）",
                    "アプリ設定（カレンダーの表示モード、言語、その他のユーザー設定）",
                ],
            },
            {
                title: "位置情報の取り扱い",
                paragraphs: [
                    "本アプリは、動画のEXIFに含まれるGPS座標を端末内で読み取り、登録済みのスキー場リストと照合してゲレンデ名を推定します。位置情報は外部に送信されず、利用者がゲレンデ名を確認・編集した結果のみが端末内に保存されます。",
                ],
            },
            {
                title: "動画データの取り扱い",
                paragraphs: [
                    "本アプリは、原則として写真ライブラリ内の動画ファイルを参照する形で利用します。整理のために動画本体を複製することはなく、動画ファイル自体は端末またはiCloud上の写真ライブラリに残ります。",
                ],
            },
            {
                title: "第三者への提供",
                paragraphs: ["本アプリは、利用者のデータを第三者に提供しません。広告SDKやアナリティクスSDKも組み込まれていません。"],
            },
            {
                title: "権限",
                items: [
                    "写真ライブラリ：動画の選択・参照のために必要です",
                    "カメラロールへの追加：将来的な書き出し機能のために要求する場合があります",
                ],
            },
            {
                title: "データの削除",
                paragraphs: [
                    "利用者は本アプリをアンインストールすることで、本アプリが端末内に保持していたすべてのデータ（メモ、タグ、日記、設定など）を削除できます。写真ライブラリ内の動画ファイル本体には影響しません。",
                ],
            },
            {
                title: "本ポリシーの変更",
                paragraphs: ["本ポリシーの内容は、必要に応じて改定することがあります。重要な変更がある場合は、本ページ上で告知します。"],
            },
            {
                title: "お問い合わせ",
                paragraphs: ["本ポリシーに関するお問い合わせは、以下のメールアドレスまでご連絡ください。"],
            },
        ],
        footer: footerByLocale.ja,
    },
    en: {
        locale: "en",
        lang: "en",
        path: privacyPaths.en,
        title: "Privacy Policy - SnowLog",
        description:
            "SnowLog privacy policy, including the data SnowLog handles, where it is stored, and whether it is shared with third parties.",
        heading: "Privacy Policy",
        eyebrow: "Privacy Policy",
        lastUpdatedLabel: "Last updated",
        lastUpdated: "2026-05-04",
        contactRevealLabel: "Show contact",
        nav: {
            ...navByLocale.en,
            alternateHref: privacyPaths.ja,
            alternateLabel: "JA",
        },
        sections: [
            {
                title: "Introduction",
                paragraphs: [
                    "SnowLog is an iOS application personally developed and provided by Kotaro Sasagawa. This policy explains what data the app handles, where that data is stored, and how it is used.",
                ],
            },
            {
                title: "Data SnowLog Handles",
                paragraphs: [
                    "SnowLog does not send user data to the developer's server or to third-party servers. The following information is stored only on the user's device.",
                ],
                items: [
                    "References to video files, including photo library asset IDs, filenames, capture dates, and thumbnails",
                    "User-entered notes, titles, tags, techniques, and favorite information",
                    "Diary entries, including resort, weather, snow quality, impressions, temperature, companions, fatigue, cost, and run count",
                    "App settings, including calendar display mode, language, and other user preferences",
                ],
            },
            {
                title: "Location Data",
                paragraphs: [
                    "SnowLog reads GPS coordinates contained in video EXIF metadata on the device and compares them with a built-in list of ski resorts to estimate the resort name. Location information is not sent outside the device. Only the resort name confirmed or edited by the user is stored on the device.",
                ],
            },
            {
                title: "Video Data",
                paragraphs: [
                    "SnowLog generally works by referencing video files in the user's photo library. It does not duplicate video files just for organization. The original videos remain in the photo library on the device or in iCloud.",
                ],
            },
            {
                title: "Third-Party Sharing",
                paragraphs: ["SnowLog does not provide user data to third parties. It does not include advertising SDKs or analytics SDKs."],
            },
            {
                title: "Permissions",
                items: [
                    "Photo Library: required to select and reference videos",
                    "Add to Camera Roll: may be requested for future export features",
                ],
            },
            {
                title: "Deleting Data",
                paragraphs: [
                    "Users can delete all data stored by SnowLog on the device, such as notes, tags, diary entries, and settings, by uninstalling the app. This does not delete the original video files in the photo library.",
                ],
            },
            {
                title: "Policy Changes",
                paragraphs: ["This policy may be updated when necessary. Important changes will be announced on this page."],
            },
            {
                title: "Contact",
                paragraphs: ["For questions about this policy, please contact the following email address."],
            },
        ],
        footer: footerByLocale.en,
    },
};
