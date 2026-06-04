# ラビリンスマーブル（Labyrinth Marble）— 開発引き継ぎドキュメント

> このファイルと `index.html` をセットでClone/コピーすれば、
> どのセッションでも開発を継続できます。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| アプリ名 | **ラビリンスマーブル**（英語: Labyrinth Marble） |
| メインファイル | `index.html` (単一ファイル・約300KB) |
| 技術スタック | HTML5 Canvas 2D / 純粋JavaScript / CSSのみ（外部ライブラリ・CDN完全なし） |
| 動作環境 | Chrome / Safari / Edge でダブルクリックするだけ。オフライン完全動作 |
| 操作方法 | マウスドラッグ / スワイプ / Dパッド / 360°アナログジョイスティック / スマホジャイロ |
| UI | タイトル画面・ハンバーガーメニュー（ドロワー）・ステージロックシステム |
| PWA対応 | `manifest.json` / `sw.js` / `icons/` によりホーム画面インストール・オフライン起動が可能 |
| Android対応 | TWA (Trusted Web Activity) で Google Play Store 公開予定 |
| リポジトリ | GitHub 管理（GitHub Pages で公開） |

**ゲーム内容：** 木製の迷宮盤を傾けて、銀のビー玉をスタートからゴールへ導く。穴に落ちたらリスタート。クリアタイムで☆1〜3を獲得。**全40ステージ。**

---

## 2. ファイル構造（セクション一覧）

```
§1.  HTML/CSS定義
§2.  定数定義
§3.  ユーティリティ関数 (clamp, lerp, dist, dist2, roundRect, SeededRandom)
§4.  ステージデータ定義 (STAGE_DEFS配列)
§5.  DOM取得
§6.  ゲーム状態管理 (runtime オブジェクト)
§7.  入力管理 (keyboard / mouse / touch / gyro)
§8.  ステージ管理 (loadStage, resetBall, goNextStage...)
§9.  物理演算 (updatePhysics, applyAcceleration, resolveAllRails...)
§10. 衝突・落下判定 (checkHoleFall, checkGoal, checkSpringBounce, checkBoostPads...)
§11. 描画 (draw, drawWoodBackground, drawRails, drawBall, drawBoostPads...)
§12. 速度パネル描画 (drawSpeedPanels)
§13. 穴描画 (drawHoles, drawSingleHole, drawMovingHoleIndicator)
§14. HUD・UI更新 (updateHUD, updateStageSelect)
§15. オーバーレイ・クリア演出
§AdMob. 広告ブリッジ（onPlayEnd / window.AndroidAdMob / window.labyrinthSetBannerHeight）
§16. 到達可能性チェック (checkReachability - BFS)
§17. 単体テスト (runUnitTests - コンソールで呼び出し可)
§18. 初期化 (registerEvents, createStageSelectUI, init, gameLoop)
```

---

## 3. 主要定数（変更時は必ずここを参照）

```javascript
// キャンバス・盤面
CANVAS_W = 600, CANVAS_H = 600
PLAY = { x:34, y:34, w:532, h:532 }   // プレイ領域
MARGIN = 34                             // 外枠幅
RAIL_T = 12                             // レール（仕切り・柵）太さ

// ビー玉・穴・ゴール
BALL_R = 9.5    // ビー玉半径
HOLE_R = 12     // 穴半径（判定・描画共通）
GOAL_R = 20     // ゴール半径

// 物理（通常床）
GRAVITY      = 0.20    // 傾き→加速度係数
FRICTION     = 0.982   // 摩擦係数（フレームごとに速度に掛ける）
MAX_SPEED    = 8.0     // 最大速度
OUTER_BOUNCE = 0.38    // 外枠反発係数
RAIL_BOUNCE  = 0.32    // レール反発係数
HOLE_PULL    = 0.22    // 穴への吸引力
ESCAPE_SPD   = 4.5     // この速度以上なら穴縁を通過できる

// 物理（氷床 Stage 21〜: physics: { friction: 0.997, wallFriction: 0.97, ice: true }）
// ← stageのphysicsオブジェクトで個別上書き

// 加速/減速パネル
BOOST_MUL = 1.055   // 加速パネル倍率（フレームごと）
SLOW_MUL  = 0.900   // 減速パネル倍率（フレームごと）
BOOST_MAX = 10.0    // 加速パネル通過時の最大速度

// 5仕切りレイアウト（Stage 1〜7, 11）
D1Y=112, D2Y=202, D3Y=292, D4Y=382, D5Y=472  // 仕切りY座標（仕切り上端）
CY1=73, CY2=163, CY3=253, CY4=343, CY5=433, CY6=523  // 回廊中心Y
TURN_LX=124, TURN_RX=476  // 蛇行ターンの左右X座標

// 6仕切りレイアウト（Stage 8〜10）
E1Y=99, E2Y=176, E3Y=253, E4Y=330, E5Y=407, E6Y=484  // 仕切りY（仕切り上端）
EY1=66, EY2=143, EY3=220, EY4=297, EY5=374, EY6=451, EY7=528  // 回廊中心Y
TL6=109, TR6=491  // ターン左右X

// ステージ数
TOTAL_STAGES = 40
```

---

## 4. ステージ一覧・設計思想

### レイアウト分類

| 分類 | ステージ | 概要 |
|------|---------|------|
| 5仕切り蛇行 | 1〜7, 11 | 左右蛇行の6回廊、通路幅78px |
| 6仕切り蛇行 | 8〜10 | 左右蛇行の7回廊、通路幅65px |
| 7×7格子迷路（通常床） | 12〜20 | 7列×7行の真の迷路、rails+holeで構成 |
| 7×7格子迷路（氷床） | 21〜40 | ice物理、全ギミック混合、高難易度 |

### 全ステージ一覧

| Stage | 名前 | difficulty | 特徴 |
|-------|------|-----------|------|
| 1 | はじめての木製迷路 | 1 | 穴3個のみ |
| 2 | 縦横の回廊 | 2 | スタブ2本+穴5個 |
| 3 | 穴よけ修行 | 3 | 穴多数 |
| 4 | 迷路の分岐路 | 4 | スタブ4本+穴多数 |
| 5 | 狭い蛇行回廊 | 5 | スタブ6本+穴大量 |
| 6 | 回り道と減速帯 | 6 | 減速パネル4枚 |
| 7 | 加速と穴の罠 | 7 | 加速パネル5枚 |
| 8 | 複雑な7回廊 | 8 | スタブ10本+混合パネル |
| 9 | 嵐の7回廊 | 9 | 密スタブ+パネル6枚 |
| 10 | 最終迷路・封印の盤 | 10 | 全ギミック混合・最高密度 |
| 11 | 揺れる奈落 | 9 | movingHole10個（初登場） |
| 12 | BRIOラビリンス | 10 | 7×7本格迷路、行き止まり穴14個 |
| 13 | 惑わしの迷路 | 9 | 7×7格子、偽路8本+movingHole |
| 14 | 爆走S字 | 8 | 7×7、S字経路+加速パネル |
| 15 | 移動穴の門 | 10 | 7×7、movingHole多数 |
| 16 | 加速する罠 | 11 | 7×7、boostPanel+movingHole |
| 17 | 減速の試練 | 12 | 7×7、slowPanel+movingHole |
| 18 | 真の迷宮 | 13 | 7×7、複雑経路+movingHole |
| 19 | 迷宮深部 | 14 | 7×7、高密度movingHole |
| 20 | 加速迷宮 | 15 | 7×7、全種パネル+movingHole |
| **21** | **氷の迷宮** | **15** | **氷床初登場**、7×7 |
| **22** | **脈動の氷迷宮** | **16** | **pulsingHole初登場**、氷床 |
| **23** | **弾けるバネ迷宮** | **17** | **springBumper初登場**、氷床 |
| 24 | 暗闇迷宮 | 18 | 氷床+全ギミック混合 |
| 25 | 氷上の狂宴 | 19 | 氷床+orbit+free+pulsing |
| 26 | 螺旋の狂乱 | 20 | 氷床+orbitHole多数 |
| **27** | **奈落の迷宮** | **21** | **orbitHole×5+freeHole×3多用** |
| **28** | **疾風の魔宮** | **22** | **boostPad初登場**（方向付き加速パッド）|
| 29 | 嵐の魔宮 | 23 | 全ギミック混合 |
| 30 | 極限迷宮 | 24 | 全ギミック最大密度 |
| 31 | 覇王迷宮 | 25 | 全ギミック最大密度 |
| 32 | 無双迷宮 | 26 | 全ギミック最大密度 |
| **33** | **鬼神迷宮** | **27** | 全ギミック最大密度、最難関 |
| 34〜40 | （高難易度続編） | 28〜 | 氷床+全ギミック統合、difficulty 28〜34 |

### ☆ 評価基準（各ステージのstarTimes参照）
- ☆☆☆：`three`秒以内
- ☆☆：`two`秒以内
- ☆：`one`秒以内（それ以上でも☆1は取れる）

---

## 5. 重要なコード構造

### レール定義ヘルパー

```javascript
// 水平レール（仕切り・横壁）
const hr = (x1, x2, y) => ({ x:x1, y, w:x2-x1, h:RAIL_T });
// 垂直レール（スタブ・縦壁）  ← 引数順に注意: (y上端, y下端, x位置)
const vr = (y1, y2, x) => ({ x, y:y1, w:RAIL_T, h:y2-y1 });

// 穴・パネル定義
const holeAt = (x, y, r) => ({ x, y, r: r || HOLE_R });
const panel  = (x, y, w, h, type) => ({ x, y, w, h, type }); // type: 'boost'|'slow'

// 5仕切りレイアウト用スタブヘルパー（最大51px）
const stubT5 = (n, h, x) => vr(C5_TOP[n], C5_TOP[n]+Math.min(h,51), x);  // 上から
const stubB5 = (n, h, x) => vr(C5_BOT[n]-Math.min(h,51), C5_BOT[n], x);  // 下から

// 6仕切りレイアウト用スタブヘルパー（最大38px）
const stubT6 = (n, h, x) => vr(C6_TOP[n], C6_TOP[n]+Math.min(h,38), x);
const stubB6 = (n, h, x) => vr(C6_BOT[n]-Math.min(h,38), C6_BOT[n], x);
```

### 7×7グリッド座標系（Stage 12〜40）

```
グリッド: 7列(col 0-6) × 7行(row 0-6)
セル中心 = (72 + col*76, 72 + row*76)

col:   0    1    2    3    4    5    6
x:    72  148  224  300  376  452  528

row:   0    1    2    3    4    5    6
y:    72  148  224  300  376  452  528

境界座標（壁の位置）:
x境界: 34, 110, 186, 262, 338, 414, 490, 566
y境界: 34, 110, 186, 262, 338, 414, 490, 566

hr(x1, x2, y)  例: hr(34,110, 110) = col0の上辺（row0/row1境界の左セグメント）
vr(y1, y2, x)  例: vr(34,110, 110) = row0の右辺（col0/col1境界の上セグメント）
         ↑注意: 第3引数がx座標（左辺として扱うのではなく「位置」）
```

### ⚠️ vr の引数順 — 最重要注意事項

```javascript
// vr(y1, y2, x)  ← 第1・2引数はY範囲、第3引数がX位置
vr(34, 110, 110)   // = x=110の壁、y∈[34,110] = col0/col1境界のrow0区間
vr(110, 186, 338)  // = x=338の壁、y∈[110,186] = col3/col4境界のrow1区間
```

### ギミックヘルパー一覧

```javascript
// 移動穴: 1軸サイン波移動
const movingHole = (x0, y0, axis, range, speed, phase=0) =>
  ({ x0, y0, x:x0, y:y0, r:HOLE_R, axis, range, speed, phase, moving:true });

// 脈動穴: 固定位置で半径が脈動 (Stage 22〜)
const pulsingHole = (x, y, minR, maxR, speed, phase=0) =>
  ({ x0:x, y0:y, x, y, r:minR, minR, maxR, axis:'x', range:0,
     speed, phase, moving:true, pulsing:true });

// 円軌道穴: 中心の周りを円運動 (Stage 25〜)
const orbitHole = (cx, cy, orbitR, speed, phase=0) =>
  ({ x0:cx, y0:cy, x:cx+orbitR, y:cy, r:HOLE_R,
     cx, cy, orbitR, speed, phase, moving:true, orbit:true });

// 自由軌道穴: リサジュー図形で2次元移動 (Stage 27〜)
const freeHole = (x0, y0, rx, ry, speedX, speedY, phaseX=0, phaseY=0) =>
  ({ x0, y0, x:x0, y:y0, r:HOLE_R,
     rx, ry, speedX, speedY, phaseX, phaseY, moving:true, free:true });

// バネバンパー: 当たると高反発で弾き返す障害物 (Stage 23〜, restitution=1.40)
const springBumper = (x0, y0, axis, range, speed, phase=0) =>
  ({ x0, y0, x:x0, y:y0, r:13, axis, range, speed, phase, hitTime:-999 });

// 加速パッド: 踏むと指定方向へ速度付与 (Stage 28〜, cooldown=0.5s)
const boostPad = (x, y, dvx, dvy) =>
  ({ x, y, dvx, dvy, r:15, lastHit:-999 });
```

### AdMob 広告ブリッジ（Android TWA 向け）

```javascript
// Android 側が window.AndroidAdMob を注入したときだけ動作
// ブラウザ・PWA 環境ではノーオペ

// バナー広告スペース制御（Android TWA → HTML 側 JS を呼び出す）
window.labyrinthSetBannerHeight = function(px) {
  document.getElementById('admob-banner-space').style.height = px + 'px';
};

// インタースティシャル広告カウンター
let _adPlayEndCount = 0;
function onPlayEnd() {
  _adPlayEndCount++;
  if (_adPlayEndCount < 5) return;
  const bridge = window.AndroidAdMob;
  if (!bridge) return;
  const shown = bridge.showInterstitial();
  if (shown) {
    _adPlayEndCount = 0;
    bridge.preloadInterstitial?.();
  }
}
// showFailOverlay() と showClearOverlay() の末尾で onPlayEnd() を呼ぶ
// restartBtn のハンドラでは呼ばない（リスタート = プレイ終了ではない）
```

---

## 6. 7×7格子迷路の壁設計ルール（Stage 12〜40 設計時必読）

### 開口部と壁の関係

```
経路セグメント「col4を南に進む」→ hr壁が開口している必要がある
  (4,0)↔(4,1): hr(338,414, 110) が walls配列に含まれない → OPEN
  (4,1)↔(4,2): hr(338,414, 186) が walls配列に含まれない → OPEN

経路セグメント「row3を東に進む」→ vr壁が開口している必要がある
  (5,3)↔(6,3): vr(262,338, 490) が walls配列に含まれない → OPEN
```

### 壁設計チェックリスト

1. **経路上の全接続を確認**: 各セグメントの開口壁がrailsに含まれていないことを確認
2. **行き止まり・トラップを封鎖**: 経路外の接続はrailsに含まれているか確認
3. **vr第3引数はx座標**: `vr(262,338, 490)` = x=490の壁
4. **rails:キーを使う**: `walls:` は認識されない（エンジンは `stage.rails` を参照）

---

## 7. 穴・柵の配置ルール（5仕切り/6仕切りレイアウト）

| ルール | 数値 |
|--------|------|
| 穴中心 → 柵の最近傍点 の距離 | **≥ 14px** |
| 穴エッジ → 柵エッジ の通過幅 | **≥ 19px**（= 2 × BALL_R）|
| 穴中心 → 外壁内面 の距離 | ≥ HOLE_R = 12px |
| スタブ高さ（5仕切り） | ≤ 51px、実用は35px以下推奨 |
| スタブ高さ（6仕切り） | ≤ 38px、実用は32px以下推奨 |
| 移動穴のY軌跡（5仕切り） | 回廊内面 ± HOLE_R に収まること |

---

## 8. 全セッションで実施した変更（累計）

### 8-1. 基本ゲーム機能（初期）
- 5仕切り・6仕切り蛇行レイアウト（Stage 1〜10）
- 穴落下・ゴール・クリア演出
- ☆評価システム（starTimes）

### 8-2. 新機能追加（中期）
- **ジャイロ操作**：「傾けON」ボタン → DeviceOrientationEvent / iOS 13+ requestPermission 対応
- **転がり音**：速度連動バンドパスノイズ（`updateRollSound`）
- **衝突・落下・ゴール音**：Web Audio API による手続き型サウンド
- **大理石ビー玉**：`ball.rotation` ベースのベジェ曲線縞模様
- **BRIOスタイル穴番号**：`drawSingleHole(hole, num)` に番号引数追加、金色テキスト表示
- **ステージ選択UI**：`#stageSelect` コンテナ + `.stage-btn` CSS

### 8-3 〜 8-6. Stage 11〜33（7×7格子・全ギミック統合）
- Stage 11：movingHole初登場
- Stage 12：7×7格子迷路初登場
- Stage 21：氷床物理初登場
- Stage 22：pulsingHole / Stage 23：springBumper / Stage 25〜：orbitHole
- Stage 27：freeHole / Stage 28：boostPad
- Stage 29〜33：全ギミック統合・最高難易度

### 8-7. バグ修正履歴
- Stage 2, 9：穴-柵オーバーラップ修正
- Stage 10 穴#11・#12：クリア不可能バグ修正
- Stage 33「鬼神迷宮」：`walls:` → `rails:` キー修正・封鎖壁の修正（2026-05-28）

### 8-8. UI大改修（2026-06-03）

#### タイトルスクリーン（`#titleScreen`）— 全面リデザイン
- 木製テーマのフルスクリーンタイトル画面（木目テクスチャ・金エンボス文字）
- Canvas で迷路盤ミニプレビューをアニメーション描画（`drawTitlePreview()`）
- **「▶ はじめから」**：ステージ1からスタート
- **「⏩ 続きから (Stage X)」**：クリア記録がある場合のみ表示
- `.ttl-wordmark`（"LABYRINTH"）+ `.ttl-wordmark-sub`（"MARBLE"）の2段表示
- `.ttl-jp`：「ラビリンスマーブル」
- `.ttl-tagline`：「MARBLE BALANCE GAME」

#### ステージロック/アンロックシステム
```javascript
const clearedStages = new Set(JSON.parse(localStorage.getItem('clearedStages') || '[]'));
function markStageCleared(index) { ... }
function isStageUnlocked(index) { return index === 0 || clearedStages.has(index - 1); }
```

#### ハンバーガーメニュー・ドロワー（`#drawerOverlay` / `#drawer`）
- HUDの **☰ボタン**（`#menuBtn`）でボトムシートを表示
- ドロワー内コンテンツ：ステージ選択・操作モード・感度スライダー・SFX音量・リスタート・全リセット・**🏠 トップ画面に戻る**

#### 360°アナログジョイスティック
- 操作モード「🔘 360°」選択時に `#controlArea` に表示
- `input.joystickX / joystickY`（-1〜1）で入力

#### Dパッド / ジョイスティックを `#controlArea` へ移動
- canvas 外の下部に独立配置（盤面と重なりなし）

### 8-9. Google Play / AdMob 対応（2026-06-04）

#### タイトル変更
- アプリ名を **「ラビリンスマーブル」**（Labyrinth Marble）に統一
- `<title>`, `apple-mobile-web-app-title`, タイトル画面のすべてを更新

#### AdMob 広告統合（HTML側）
- `#admob-banner-space`：`#app` 最下部にバナー用スペース div（初期 height:0）
- `window.labyrinthSetBannerHeight(px)`：Android TWA から呼んで余白を拡張
- `onPlayEnd()` 関数：クリア/失敗後 5プレイ終了ごとにインタースティシャル要求
  - リスタートはカウントしない
  - 表示成功時にカウントリセット＋次の広告を事前読み込み
  - `window.AndroidAdMob` が存在しない環境（ブラウザ・PWA）ではノーオペ

#### sw.js v4（Network First 更新）
- `index.html` は **Network First**（更新後に古いHTMLが残らない）
- 失敗時はキャッシュにフォールバック（オフライン対応維持）
- その他アセットは Cache First

#### 新規ファイル追加
- `privacy-policy.html`：AdMob・ジャイロセンサー・個人情報なしを明記
- `.well-known/assetlinks.json`：TWA 用プレースホルダー（SHA-256 は後で設定）
- `icons/maskable-512.png`：セーフゾーン80%・木色背景のマスカブルアイコン

#### manifest.json 更新
```json
{
  "name": "ラビリンスマーブル",
  "short_name": "ラビリンスマーブル",
  "description": "木製迷路盤を傾けて銀の玉をゴールへ導くラビリンス・バランスゲーム。全40ステージ。"
}
```
- アイコン定義を `any` / `maskable` 別エントリに分離

---

## 9. 新ステージ設計テンプレート（高難易度氷床）

```javascript
// ステージ追加時のテンプレート
{
  id: 41, name: 'XXX', difficulty: 35,
  starTimes: { three: 320, two: 500, one: 750 },
  start: { x: 72, y: 72 },
  goal:  { x: 528, y: 528 },
  physics: { friction: 0.997, wallFriction: 0.97, ice: true },
  rails: [ hr(...), vr(...), ... ],
  holes: [ holeAt(x, y), ... ],
  movingHoles: [
    orbitHole(cx, cy, 34~38, 0.67~0.74, phase),
    freeHole(x0, y0, rx, ry, sx, sy, px, py),
    pulsingHole(x, y, 4, 26, 0.67~0.72, phase),
  ],
  springBumpers: [ springBumper(x0, y0, 'x', 34, 0.48~0.53, phase) ],
  boostPads: [ boostPad(x, y, dvx, dvy) ],
  guidePath: [ {x, y}, ... ],
},
// TOTAL_STAGES の値も +1 すること
```

---

## 10. 動作確認チェックリスト

### 基本動作
- [ ] ブラウザで開いてタイトル画面（ラビリンスマーブル）が表示される
- [ ] 「▶ はじめから」でゲーム開始、ビー玉が動く
- [ ] 穴に落ちるとリスタート演出が出る
- [ ] ゴールに入るとクリア画面が出る・次ステージのロックが解除される

### UI
- [ ] HUD右の ☰ボタン でドロワーが開く
- [ ] ドロワー内でステージ選択できる（クリア済みは緑、未クリアはグレー）
- [ ] 「🔘 360°」でジョイスティックが下部に表示され操作できる
- [ ] 「🕹 Dパッド」で十字キーが下部に表示される
- [ ] 「🏠 トップ画面に戻る」でタイトル画面に戻れる
- [ ] 効果音スライダー0で無音になる

### PWA / Android
- [ ] GitHub Pages の HTTPS URL でアクセスできる
- [ ] ブラウザの「ホーム画面に追加」でインストールできる
- [ ] オフライン起動が機能する（sw.js v4）
- [ ] `privacy-policy.html` にアクセスできる
- [ ] `.well-known/assetlinks.json` にアクセスできる（TWA 検証用）

### ステージ動作
- [ ] Stage 21 以降で氷の表面描画・滑り物理が動作する
- [ ] Stage 22 以降で脈動する穴が動いている
- [ ] Stage 33「鬼神迷宮」でゴールまで到達可能
- [ ] ブラウザコンソールで `runUnitTests()` → PASS が出る

---

## 11. 別デバイスでの開発継続手順

1. GitHub からリポジトリを `git clone` するか、ZIP ダウンロードして展開する
2. Claude Code を起動し、そのフォルダを開く
3. 新しいチャットで **このドキュメントをアップロード** してから以下を伝える：

```
ラビリンスマーブルの開発を続けたいです。
添付の labyrinth_context*.md が引き継ぎドキュメントです。
index.html が現在のゲームファイル（全40ステージ実装済み・PWA+Google Play対応済み）です。
内容を把握した上で、[やりたいこと] をお願いします。
```

---

## 12. PWA 設定（2026-06-04 更新）

### プロジェクトファイル構成

```
labyrinth-game/
├── index.html              # メインゲームファイル（HTML+CSS+JS 全込み）
├── manifest.json           # PWA マニフェスト（ラビリンスマーブル）
├── sw.js                   # Service Worker v4（index.html: Network First）
├── privacy-policy.html     # プライバシーポリシー（AdMob・ジャイロ対応）
├── README.md               # Google Play / TWA / AdMob 情報込み
├── icons/
│   ├── icon-192.png        # PWA アイコン 192px
│   ├── icon-512.png        # PWA アイコン 512px
│   └── maskable-512.png    # マスカブルアイコン 512px（セーフゾーン80%）
└── .well-known/
    └── assetlinks.json     # TWA 用デジタルアセットリンク（SHA-256 要設定）
```

### manifest.json 現在の設定

```json
{
  "name": "ラビリンスマーブル",
  "short_name": "ラビリンスマーブル",
  "description": "木製迷路盤を傾けて銀の玉をゴールへ導くラビリンス・バランスゲーム。全40ステージ。",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#d4b06a",
  "theme_color": "#5c2e0e"
}
```

### sw.js v4 キャッシュ戦略

```javascript
const CACHE = 'labyrinth-v4';
// index.html: Network First（更新を即反映・失敗時はキャッシュ）
// manifest.json / icons / privacy-policy.html: Cache First（オフライン対応）
```

### index.html の PWA 関連 head タグ

```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#5c2e0e">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ラビリンスマーブル">
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

---

## 13. Google Play Store 公開方針（2026-06-04 追加）

### 公開方式
PWA を **Trusted Web Activity (TWA)** で包み、`.aab` として Google Play に提出する。

### Android プロジェクト（`labyrinth-game-android/`）

```
labyrinth-game-android/
├── twa-manifest.json     # Bubblewrap 設定（packageId・host・startUrl 等）
├── store-listing.md      # ストア掲載文（JP/EN・Data safety・Content rating）
└── BUILD_GUIDE.md        # ビルド手順書（Bubblewrap→Keystore→.aab→Play Console）
```

### twa-manifest.json 主要設定

```json
{
  "packageId": "com.shuntube.labyrinthmarble",
  "host": "shuntube2026-gif.github.io",
  "name": "ラビリンスマーブル",
  "startUrl": "/labyrinth-game/index.html",
  "display": "standalone",
  "orientation": "portrait",
  "themeColor": "#5c2e0e",
  "backgroundColor": "#d4b06a",
  "minSdkVersion": 23,
  "targetSdkVersion": 35
}
```

### AdMob 設定（Android 側 作業リスト）

| 作業 | 状態 |
|---|---|
| HTML 側バナースペース (`#admob-banner-space`) | ✅ 実装済み |
| HTML 側 JS ブリッジ (`window.AndroidAdMob`) | ✅ 実装済み |
| インタースティシャルカウンター (`onPlayEnd()`) | ✅ 実装済み |
| AdMob アプリ・広告ユニット作成 | ⬜ 要手動 |
| AndroidManifest.xml への APP_ID 追記 | ⬜ Claudeが追記可能 |
| Activity への JavascriptInterface 実装 | ⬜ 要手動 or 詳細後述 |

### 残り作業（手動が必要）

1. JDK 17 + Android Studio インストール
2. `bubblewrap update`（`labyrinth-game-android/` で実行）
3. Keystore（署名鍵）作成 → SHA-256 を `.well-known/assetlinks.json` に反映
4. `bubblewrap build` → `.aab` 生成
5. AdMob でアプリ・広告ユニット作成
6. AndroidManifest.xml に APP_ID 追記（Claude が対応可）
7. Play Console でストア情報・スクリーンショット・Data safety 登録

---

## 14. 今後のアイデア（未実装）

- [ ] **BGM**：Web Audio API で環境音（木のきしみ・環境SEなど）
- [ ] **移動する壁**：往復する柵ギミックのステージ
- [ ] **タイムアタックモード**：全ステージ通しのタイム計測
- [ ] **リプレイ保存**：クリア後に軌跡を再生
- [ ] **本物BRIO配置ステージ**：83穴番号順の本家マップ再現
- [x] ~~モバイル最適化~~ → ドロワー内スライダーで実装済み
- [x] ~~デバッグ非表示~~ → CSS `display:none!important` で実装済み
- [x] ~~360°バーチャルパッド~~ → アナログジョイスティック実装済み
- [x] ~~ハンバーガーメニュー~~ → ドロワーUI実装済み
- [x] ~~タイトル/スタート画面~~ → 木製テーマフルリデザイン済み
- [x] ~~ステージロックシステム~~ → localStorage永続化で実装済み
- [x] ~~PWAアイコン差し替え~~ → 実際の木製ボード写真アイコン実装済み
- [x] ~~Google Play 対応~~ → TWA 方針・AdMob統合・privacy-policy.html 実装済み

---

*最終更新: 2026-06-04 / 担当AI: Claude (Claude Code) / 対応バージョン: Stage 40まで（全ステージ動作確認済み・PWA v4・Google Play 対応済み・ラビリンスマーブルにタイトル変更済み）*
