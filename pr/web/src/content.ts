import screenshot2 from "./assets/screenshots/screenshot-2.png";
import screenshot3 from "./assets/screenshots/screenshot-3.png";
import screenshot4 from "./assets/screenshots/screenshot-4.png";
import screenshot5 from "./assets/screenshots/screenshot-5.png";
import { homePath, type HomeContent, type PrivacyContent } from "./i18n";

const nav: HomeContent["nav"] = {
    homeAria: "SnowLog home",
    homeHref: homePath,
    appStoreAria: "App StoreでSnowLogを開く",
};

const footer: HomeContent["footer"] = {
    ariaLabel: "Footer navigation",
    appStore: "App Store",
    github: "GitHub",
    privacy: "Privacy",
};

export const homeContent: HomeContent = {
    title: "SnowLog - Snow Video Review App",
    description: "SnowLogは、スキー・スノーボードの滑走動画をゲレンデ、技術、日付で整理して振り返るためのiOSアプリです。",
    nav,
    hero: {
        eyebrow: "Snow Video Review App",
        titleLines: ["滑走動画を、練習ログへ。"],
        lead: "SnowLogは、スキー・スノーボードの動画をゲレンデ、技術、日付で整理して振り返るためのiOSアプリです。",
        appStoreAria: "App StoreでSnowLogをダウンロード",
        note: "iOS向け / オフラインファースト / 日本語・英語対応",
    },
    video: {
        eyebrow: "Movie",
        title: "1分半で分かる、SnowLog。",
        ariaLabel: "SnowLogの紹介映像",
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
                body: "大回り、小回り、コブなど、動画に練習内容を紐づけて残せます。",
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
        title: "動画を増やすほど効く、\n端末内整理。",
        body: "SnowLogはクラウド同期を前提にせず、動画の情報を端末内で管理します。\n大容量の滑走動画を整理のためだけに複製しないため、撮影本数が増えても運用しやすい設計です。",
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
                answer: "メモやタグ、位置情報を含む利用者のデータは端末内で完結します。サーバー同期やアナリティクスSDKは組み込まれていません。最新版の確認のためApp Storeの公開情報を取得する通信のみ行いますが、利用者のデータは含みません。",
            },
            {
                question: "機種変更時にデータは引き継がれますか？",
                answer: "現在、端末間でデータを移行する機能は提供していません。JSON形式でのエクスポートを実装予定ですが、時期は未定です。",
            },
            {
                question: "英語表示に対応していますか？",
                answer: "日本語と英語の表示に対応しています。端末の言語設定に追従して切り替わります。",
            },
        ],
    },
    footer,
};

export const privacyContent: PrivacyContent = {
    title: "プライバシーポリシー - SnowLog",
    description:
        "SnowLogのプライバシーポリシー。SnowLogが扱うデータの種類、保存場所、第三者提供の有無について説明します。",
    heading: "プライバシーポリシー",
    eyebrow: "Privacy Policy",
    lastUpdatedLabel: "最終更新日",
    lastUpdated: "2026-07-17",
    contactLinkLabel: "GitHubリポジトリ",
    nav,
    sections: [
        {
            title: "はじめに",
            paragraphs: [
                "SnowLog（以下「本アプリ」）は、kmch4n（以下「開発者」）が個人で開発・提供するiOS向けアプリケーションです。本ポリシーは、本アプリが扱うデータの種類、保存場所、利用目的を明らかにします。",
            ],
        },
        {
            title: "収集するデータ",
            paragraphs: [
                "本アプリは、開発者または第三者のサーバーに利用者のデータを送信しません。以下の情報は、すべて利用者の端末内にのみ保存されます。外部との通信については「第三者への提供」をご覧ください。",
            ],
            items: [
                "動画ファイルへの参照情報（写真ライブラリのアセットID、ファイル名、撮影日時、再生時間、サムネイル）",
                "利用者が入力・選択したタイトル、メモ、タグ、テクニック、ゲレンデ名、お気に入り情報",
                "日記エントリ（ゲレンデ、天候、雪質、感想、気温、同行者、疲労度、費用、本数）",
                "アプリ設定（週の開始曜日、ホーム画面の並び順、その他のユーザー設定）",
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
                "本アプリは、原則として写真ライブラリ内の動画ファイルを参照する形で利用します。この場合、整理のために動画本体を複製することはなく、動画ファイル自体は端末またはiCloud上の写真ライブラリに残ります。",
                "ただし、写真ライブラリのアセットとして扱えない動画を取り込んだ場合に限り、動画本体を本アプリ内に複製して保存します。この複製は本アプリの管理領域に置かれ、動画の削除時およびアプリのアンインストール時に削除されます。",
            ],
        },
        {
            title: "第三者への提供",
            paragraphs: [
                "本アプリは、利用者のデータを第三者に提供しません。広告SDKやアナリティクスSDKも組み込まれていません。",
                "唯一の外部通信として、本アプリは最新版の有無を確認するためにApp Storeの公開情報を取得します。この通信が送信するのは本アプリの識別子のみで、利用者のデータは含みません。",
            ],
        },
        {
            title: "権限",
            items: [
                "写真ライブラリ：動画の選択・参照のために必要です",
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
            paragraphs: ["本ポリシーに関するお問い合わせは、GitHubリポジトリよりご連絡ください。"],
        },
    ],
    footer,
};
