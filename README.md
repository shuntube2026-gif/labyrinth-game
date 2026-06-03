# ラビリンスマーブル

木製迷路盤を傾けて、銀のビー玉を START から FINISH まで導くバランスゲームです。

## 概要

- HTML5 Canvas / CSS / JavaScript のみで構成（外部ライブラリ・CDN なし）
- GitHub Pages で公開・PWA 対応
- スマホのホーム画面から起動可能（オフライン対応）
- 全 40 ステージ
- マウス / スワイプ / バーチャル Dパッド / 360°ジョイスティック / ジャイロ操作に対応

## ファイル構成

```
index.html           ゲーム本体（Canvas + 純粋 JavaScript 単一 HTML）
manifest.json        PWA 設定
sw.js                Service Worker（Network First + Cache First）
privacy-policy.html  プライバシーポリシー
README.md
icons/
  icon-192.png       PWA アイコン 192px
  icon-512.png       PWA アイコン 512px
.well-known/
  assetlinks.json    TWA 用デジタルアセットリンク（要 SHA-256 設定）
```

## プレイ方法

1. [GitHub Pages で遊ぶ](https://yourname.github.io/labyrinth-game/)
2. iPhone / Android のブラウザで開き「ホーム画面に追加」でアプリとして使用可能
3. Android 版は Google Play Store からインストール（予定）

## 操作方法

| モード | 操作 |
|---|---|
| スワイプ | 画面をドラッグして傾きを操作 |
| バーチャル Dパッド | 画面下の十字ボタンを押す |
| 360°ジョイスティック | 画面下のアナログスティックをドラッグ |
| ジャイロ | スマートフォンを傾ける（許可が必要） |
| キーボード | ↑↓←→ / WASD |

## Android / Google Play 公開方針

Google Play Store への公開は **Trusted Web Activity (TWA)** を使用します。

### 必要な追加対応

- [x] `privacy-policy.html` の追加
- [x] `.well-known/assetlinks.json` の追加（SHA-256 要設定）
- [ ] Google Play 用アイコン・スクリーンショットの作成
- [ ] Bubblewrap / Android Studio による `.aab` ビルド
- [ ] Target SDK 35 以上での提出
- [ ] Data safety / Content rating の入力

### TWA 設定値（Bubblewrap 用）

```
packageName : com.yourname.labyrinthmarble
host        : yourname.github.io
startUrl    : /labyrinth-game/index.html
displayMode : standalone
orientation : portrait
minSdk      : 23
targetSdk   : 35
```

### AdMob 広告（Android 版）

- **バナー広告**: 画面最下部 Adaptive Banner。HTML 側は `#admob-banner-space` で余白確保済み。
- **インタースティシャル**: クリア or 失敗 5 回ごとに最大 1 回。リスタートはカウントしない。
- **JavaScript ブリッジ**: `window.AndroidAdMob.showInterstitial()` / `window.AndroidAdMob.preloadInterstitial()` / `window.labyrinthSetBannerHeight(px)`

## 技術仕様

- `TOTAL_STAGES = 40`
- `localStorage` 保存: クリア済みステージ、星評価、操作モード、音量
- Service Worker: v4（index.html は Network First、アセットは Cache First）
- 個人情報収集なし / 広告識別子は AdMob 経由のみ（Android 版）

## ライセンス

MIT License
