# 木製ラビリンス迷宮バランスゲーム — 開発引き継ぎドキュメント

> このファイルと `index.html` をセットでClone/コピーすれば、
> どのセッションでも開発を継続できます。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| メインファイル | `index.html` (単一ファイル・約280KB) |
| 技術スタック | HTML5 Canvas 2D / 純粋JavaScript / CSSのみ（外部ライブラリ・CDN完全なし） |
| 動作環境 | Chrome / Safari / Edge でダブルクリックするだけ。オフライン完全動作 |
| 操作方法 | マウスドラッグ / スワイプ / Dパッド / 360°アナログジョイスティック / スマホジャイロ |
| UI | タイトル画面・ハンバーガーメニュー（ドロワー）・ステージロックシステム |
| PWA対応 | `manifest.json` / `sw.js` / `icons/` によりホーム画面インストール・オフライン起動が可能 |
| リポジトリ | GitHub 管理（`index.html`, `manifest.json`, `sw.js`, `icons/`） |

**ゲーム内容：** 木製の迷宮盤をマウスで傾け、大理石ビー玉をスタートからゴールへ導く。穴に落ちたらリスタート。クリアタイムで☆1〜3を獲得。全33ステージ。

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
TOTAL_STAGES = 33
```

---

## 4. ステージ一覧・設計思想

### レイアウト分類

| 分類 | ステージ | 概要 |
|------|---------|------|
| 5仕切り蛇行 | 1〜7, 11 | 左右蛇行の6回廊、通路幅78px |
| 6仕切り蛇行 | 8〜10 | 左右蛇行の7回廊、通路幅65px |
| 7×7格子迷路（通常床） | 12〜20 | 7列×7行の真の迷路、rails+holeで構成 |
| 7×7格子迷路（氷床） | 21〜33 | ice物理、全ギミック混合、高難易度 |

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

### 7×7グリッド座標系（Stage 12〜33）

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

// よくある間違い: 「x=110の壁、y∈[110,186]」を書こうとして
vr(110, 186, 110)  // ← これはx=110, y∈[110,186] で正しい
// 「x=262の壁、y∈[262,338]」を書こうとして
vr(262, 338, 262)  // ← これはx=262, y∈[262,338] で正しい
// 引数の役割: vr(y_start, y_end, x_position)
```

### ギミックヘルパー一覧

```javascript
// 移動穴: 1軸サイン波移動
const movingHole = (x0, y0, axis, range, speed, phase=0) =>
  ({ x0, y0, x:x0, y:y0, r:HOLE_R, axis, range, speed, phase, moving:true });
// axis='x'|'y', range=振れ幅px, speed=cycles/秒, phase=初期位相(0-1)

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
// rx/ry=振れ幅, speedX/speedY=各軸周期

// バネバンパー: 当たると高反発で弾き返す障害物 (Stage 23〜, restitution=1.40)
const springBumper = (x0, y0, axis, range, speed, phase=0) =>
  ({ x0, y0, x:x0, y:y0, r:13, axis, range, speed, phase, hitTime:-999 });

// 加速パッド: 踏むと指定方向へ速度付与 (Stage 28〜, cooldown=0.5s)
const boostPad = (x, y, dvx, dvy) =>
  ({ x, y, dvx, dvy, r:15, lastHit:-999 });
// dvx/dvy=付与速度(px/frame)、magnitude 4 推奨（氷床friction=0.997に合わせ）
```

### ステージデータ構造（7×7グリッド・高難易度タイプ）

```javascript
{
  id: 33, name: '鬼神迷宮', difficulty: 27,
  starTimes: { three: 300, two: 480, one: 720 },
  start: { x: 72, y: 72 },        // セル(0,0)の中心
  goal:  { x: 528, y: 528 },      // セル(6,6)の中心
  physics: { friction: 0.997, wallFriction: 0.97, ice: true },
  rails: [ hr(...), vr(...), ... ],          // ← 必ずrails:（wallsは不可）
  holes: [ holeAt(x,y), ... ],               // 静的穴
  movingHoles: [                             // 全動的穴（orbit/free/pulsing含む）
    orbitHole(...), freeHole(...), pulsingHole(...), movingHole(...),
  ],
  springBumpers: [ springBumper(...), ... ],
  boostPads: [ boostPad(...), ... ],
  guidePath: [ {x,y}, ... ],                 // 攻略ガイド用ウェイポイント（25点前後）
}
```

### 物理ループ呼び出し順

```javascript
function updatePlaying() {
  updatePhysics();         // 物理演算
  updateMovingHoles();     // 移動穴位置更新
  checkSpringBounce();     // バネバンパー衝突
  checkBoostPads();        // 加速パッド踏み判定
  checkHoleFall();         // 穴落下判定
  checkGoal();             // ゴール判定
}

function updatePhysics() {
  applyAcceleration();    // 傾き→加速（氷床時はfiction差を適用）
  applyFriction();        // 摩擦
  applyHolePull();        // 穴への吸引
  applySpeedPanels();     // 加速/減速パネル効果
  limitSpeed();           // MAX_SPEED制限
  moveBall();             // 位置更新
  resolveOuterWall();     // 外壁衝突
  resolveAllRails();      // レール衝突（stage.railsを参照）
}
```

### 穴落下判定（3層構造）

```javascript
// 1. 深部（hole.r × 0.65 以内）→ 速度問わず常に落下
// 2. 縁（hole.r × 1.10 以内 かつ spd <= ESCAPE_SPD=4.5）→ ゆっくりなら落下
// 3. Swept判定（spd >= 2.5のとき軌跡の中間点を最大6点チェック）→ 高速すり抜け防止
// pull zone = hole.r × 2.2 以内 → HOLE_PULL=0.22 の吸引力
```

### ジャイロ操作

```javascript
// input オブジェクトのフィールド
input.gyroX = 0;
input.gyroY = 0;
input.gyroActive = false;

// DeviceOrientationEvent ハンドラ
function onDeviceOrientation(e) {
  const maxTilt = 22;
  input.gyroX = clamp((e.gamma || 0) / maxTilt, -1, 1);
  input.gyroY = clamp(((e.beta || 45) - 45) / maxTilt, -1, 1);
}
// integrateInput内の優先順位: ジャイロ > マウス/タッチ > キーボード
```

### 転がり音・サウンド

```javascript
// Web Audio APIによる手続き型サウンド（外部ファイル不要）
// rollSrc: バンドパスフィルタ通したノイズ、速度連動でゲイン変化
function updateRollSound(spd) {
  const vol = spd > 0.4 ? Math.min(spd / MAX_SPEED * 0.052, 0.052) : 0;
  rollGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.06);
}
// 衝突音・落下音・ゴール音も実装済み
```

---

## 6. 7×7格子迷路の壁設計ルール（Stage 12〜33 設計時必読）

### 開口部と壁の関係

```
経路セグメント「col4を南に進む」→ hr壁が開口している必要がある
  (4,0)↔(4,1): hr(338,414, 110) が walls配列に含まれない → OPEN
  (4,1)↔(4,2): hr(338,414, 186) が walls配列に含まれない → OPEN

経路セグメント「row3を東に進む」→ vr壁が開口している必要がある
  (5,3)↔(6,3): vr(262,338, 490) が walls配列に含まれない → OPEN
  ↑ 第3引数=490がx座標（col5/col6境界）, 第1・2引数=262,338がrow3のy範囲
```

### 壁設計チェックリスト

1. **経路上の全接続を確認**: 各セグメントの開口壁がrailsに含まれていないことを確認
2. **行き止まり・トラップを封鎖**: 経路外の接続はrailsに含まれているか確認
3. **vr第3引数はx座標**: `vr(262,338, 490)` = x=490の壁, `vr(262,338, 262)` = x=262の壁
4. **rails:キーを使う**: `walls:` は認識されない（エンジンは `stage.rails` を参照）
5. **rails配列の整合性**: `runtime.stage.rails` がundefinedになるとゲームクラッシュ

### トラップ穴配置ルール（7×7）

| 罠の種類 | 配置場所 | 効果 |
|----------|----------|------|
| 行き過ぎ罠 | 経路端の1セル先 | 勢いよく進んだ時に落ちる |
| 偽路罠 | 開口部の先の行き止まり | 間違ったルートへ誘導 |
| 逆行罠 | 経路の逆方向 | 氷床でバックした時に落ちる |

---

## 7. 穴・柵の配置ルール（5仕切り/6仕切りレイアウト）

新しいステージを作るときに守るべき制約：

| ルール | 数値 |
|--------|------|
| 穴中心 → 柵の最近傍点 の距離 | **≥ 14px**（ビー玉が柵エッジで詰まらないため） |
| 穴エッジ → 柵エッジ の通過幅 | **≥ 19px**（= 2 × BALL_R）|
| 穴中心 → 外壁内面 の距離 | ≥ HOLE_R = 12px |
| スタブ高さ（5仕切り） | ≤ 51px（最大）、実用は35px以下推奨 |
| スタブ高さ（6仕切り） | ≤ 38px（最大）、実用は32px以下推奨 |
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
- **ステージ選択UI**：`#stageSelect` コンテナ + `.stage-btn` CSS + `createStageSelectUI()` + `updateStageSelect()`

### 8-3. Stage 11〜12（蛇行+7×7格子）
- Stage 11「揺れる奈落」：movingHole（1軸サイン波）初登場
- Stage 12「BRIOラビリンス」：7×7グリッド本格迷路初登場、行き止まり穴14個

### 8-4. Stage 13〜20（7×7格子・通常床）
- 複雑な迷路設計（偽路・行き止まり多数）
- movingHole密度の段階的増加
- 加速・減速パネル組み合わせ

### 8-5. Stage 21〜28（氷床・新ギミック追加）
- **Stage 21**：氷床物理 `physics: { friction:0.997, wallFriction:0.97, ice:true }` 初登場
- **Stage 22**：`pulsingHole` 追加（半径が脈動する穴）
- **Stage 23**：`springBumper` 追加（高反発バンパー、restitution=1.40）
- **Stage 25〜26**：`orbitHole` 多用（円軌道穴）
- **Stage 27**：`freeHole`（リサジュー自由軌道穴）大量採用
- **Stage 28**：`boostPad` 追加（方向付き速度パッド）

### 8-6. Stage 29〜33（全ギミック統合・最高難易度）
- 全ギミック（orbit×5, free×3, pulsing×3, spring×3, boostPad×5）を毎ステージ採用
- starTimesは3星200→300秒（段階的に緩和）
- 経路セグメント数：4→5→6→7→8と増加

### 8-7. バグ修正履歴
- Stage 2, 9：穴-柵オーバーラップ修正（dist≥14px確保）
- Stage 8 通過幅修正：穴座標調整
- Stage 10 穴#11・#12：スタブ強制経路との衝突（クリア不可能）修正
- Stage 27バグ：TOTAL_STAGES=27と定義していたがデータが26個 → Stage 27追加
- Stage 33バグ（2026-05-28 全修正適用済み）：
  - `walls:` → `rails:` キー修正（エンジンはstage.railsを参照 → ビー玉・ギミック未表示の原因）
  - `vr(262,338, 490)` 削除（(5,3)↔(6,3)の縦壁が経路を封鎖していた）
  - `hr(490,566, 338)`, `hr(490,566, 414)` 削除（col6 row3→row4→row5が封鎖 → ゴール到達不可の原因）
  - `hr(338,414, 262)`, `hr(490,566, 262)` 追加（col4下方向・col6上部の未封鎖壁を補完）

### 8-8. UI大改修（2026-06-03）

#### タイトルスクリーン（`#titleScreen`）
- 起動時に木製テーマのフルスクリーンタイトル画面を表示（z-index:600）
- **「▶ はじめから」**：ステージ1からスタート
- **「⏩ 続きから (Stage X)」**：前回クリア済みの続きから（クリア記録がある場合のみ表示）
- `titleScreen.classList.add('hidden')` でゲーム画面へ移行

#### ステージロック/アンロックシステム
```javascript
const clearedStages = new Set(JSON.parse(localStorage.getItem('clearedStages') || '[]'));
function markStageCleared(index) { ... } // ゴール到達時に呼ぶ
function isStageUnlocked(index) { return index === 0 || clearedStages.has(index - 1); }
```
- ドロワー内のステージボタン：未クリアは `.locked`（グレーアウト・disabled）
- クリア済みは `.cleared`（緑グラデーション）
- `updateStageSelect()` がクリア後に次ステージのロックを自動解除（`disabled = false` 付与）

#### ハンバーガーメニュー・ドロワー（`#drawerOverlay` / `#drawer`）
- 右下の **☰ボタン**（`#menuBtn`）でボトムシートを表示
- `drawerOverlay.classList.add/remove('show')` でアニメーション付き開閉
- `closeDrawer()` 関数でどこからでも閉じられる
- ドロワー内コンテンツ：
  - **ステージ選択**（`#stageSelect`）：ロック/クリア状態付きボタン
  - **操作モード**（`.ctm-btn`）：スワイプ / Dパッド / 360° / ジャイロ、選択中は `.active`（緑）
  - **感度スライダー**（`#sensSl2`）：既存の `#sensSlider` と双方向同期
  - **効果音音量スライダー**（`#sfxSlider`）：`sfxVolume` をリアルタイム更新・localStorage保存
  - **もう一度**（`#dwr-restart`）：現ステージリスタート後に閉じる
  - **全リセット**（`#dwr-reset`）：confirm後 `clearedStages` クリア・ステージ1へ

#### 360°アナログジョイスティック（`#joystick` / `#joystickBase` / `#joystickKnob`）
```javascript
input.joystickX = dx / JOY_RADIUS;  // -1〜1
input.joystickY = dy / JOY_RADIUS;  // -1〜1
```
- 操作モード「🔘 360°」選択時のみ表示（`applyControlMode()` で show/hide）
- `integrateInput()` にジョイスティックブランチを追加
- タッチ識別子（`identifier`）追跡で多点タッチでも正確に動作
- ノブは半径36pxにクランプ、離すと中央へ戻る

#### 効果音音量（`sfxVolume`）統合
- `playTone()`, `playBump()`, `playFall()`, `updateRollSound()` に `× sfxVolume` を組み込み
- `sfxVolume <= 0` の場合は早期リターン（0除算を防ぐ）

#### 旧UI非表示化
- `#dbgBtn, #sensBox, #resetBtn, #settingsBtn, #gyroBtn { display:none!important }` でデバッグ・旧設定ボタン類を完全非表示
- `#stageSelect` のデフォルト非表示、`#drawer #stageSelect` でドロワー内のみ表示

---

## 9. 新ステージ設計テンプレート（高難易度氷床）

```javascript
// ステージ34以降を追加する際のテンプレート
{
  id: 34, name: 'XXX', difficulty: 28,
  starTimes: { three: 320, two: 500, one: 750 },
  start: { x: /*72か528*/, y: /*72か528*/ },
  goal:  { x: /*528か72*/, y: /*528か72*/ },
  physics: { friction: 0.997, wallFriction: 0.97, ice: true },
  rails: [
    // 水平壁: y=110,186,262,338,414,490 の各行について
    // 経路上の hr(col_x1, col_x2, y) を除外、残りをすべて列挙
    // 垂直壁: x=110,186,262,338,414,490 の各列について
    // 経路上の vr(row_y1, row_y2, x) を除外、残りをすべて列挙
  ],
  holes: [
    // 静的トラップ穴 ×5
    // 配置: 経路の行き過ぎ先・偽路の行き止まり
    holeAt(x, y),
  ],
  movingHoles: [
    // orbit×5, free×3, pulsing×3 が標準構成
    orbitHole(cx, cy, 34~38, 0.67~0.74, phase),
    freeHole(x0, y0, rx, ry, sx, sy, px, py),
    pulsingHole(x, y, 4, 26, 0.67~0.72, phase),
  ],
  springBumpers: [
    // ×3: 各コリドーで弾き返し
    springBumper(x0, y0, 'x', 34, 0.48~0.53, phase),
  ],
  boostPads: [
    // ×5: 各コリドーの進行方向に加速
    boostPad(x, y, dvx, dvy),  // dvx/dvy ±4 が推奨
  ],
  guidePath: [
    // 経路上のセル中心を順番に列挙（25点前後）
    {x: start_x, y: start_y}, ..., {x: goal_x, y: goal_y},
  ],
},
// TOTAL_STAGES の値も +1 すること（line ~372）
```

---

## 10. 動作確認チェックリスト

### 基本動作
- [ ] ブラウザで開いてタイトル画面が表示される
- [ ] 「▶ はじめから」でゲーム開始、ビー玉がスワイプで動く
- [ ] 穴に落ちるとリスタート演出が出る
- [ ] ゴールに入るとクリア画面が出る・次のステージのロックが解除される

### 新UI
- [ ] 右下の **☰ボタン** でドロワーが開く
- [ ] ドロワー内でステージ選択できる（クリア済みは緑、未クリアはグレー）
- [ ] 「🔘 360°」を選ぶと左下にジョイスティックが表示され、タッチで操作できる
- [ ] 「🕹 Dパッド」を選ぶと十字キーが左下に表示される
- [ ] 感度スライダーと効果音スライダーが機能する（効果音量0で無音になる）
- [ ] 「全リセット」でステージロックが1に戻る
- [ ] ブラウザ再起動後もクリア済みステージが保持されている（localStorage）
- [ ] クリア記録がある場合「⏩ 続きから」ボタンがタイトルに表示される

### ステージ動作
- [ ] Stage 21 以降で氷の表面描画・滑り物理が動作する
- [ ] Stage 22 以降で脈動する穴が動いている
- [ ] Stage 23 以降でバネバンパーが弾き返す
- [ ] Stage 28 以降で加速パッド（橙色矢印）に乗ると加速する
- [ ] Stage 33「鬼神迷宮」でスタート(左上)→ゴール(右下)まで到達可能
- [ ] ブラウザコンソールで `runUnitTests()` を実行 → PASS が出る

---

## 11. 別デバイスでの開発継続手順

1. GitHub からリポジトリを `git clone` するか、ZIP ダウンロードして展開する
2. Claude Code を起動し、そのフォルダを開く
3. 新しいチャットで **このドキュメントをアップロード** してから以下を伝える：

```
木製ラビリンスバランスゲームの開発を続けたいです。
添付のlabyrinth_context.mdが引き継ぎドキュメントです。
index.htmlが現在のゲームファイル（Stage 33まで実装済み・PWA対応済み）です。
内容を把握した上で、[やりたいこと] をお願いします。
```

4. あとは普通に修正をお願いするだけでOK。

> **遊ぶだけなら** `index.html` をブラウザでダブルクリックするだけ。
> **スマホでホーム画面に追加するなら** GitHub Pages 等で HTTPS 公開後、ブラウザの「ホーム画面に追加」を使う。

---

## 12. PWA 設定（2026-05-28 追加）

### プロジェクトファイル構成

```
labyrinth-game/
├── index.html          # メインゲームファイル（HTML+CSS+JS 全込み）
├── manifest.json       # PWA マニフェスト
├── sw.js               # Service Worker（オフラインキャッシュ）
├── icons/
│   ├── icon-192.png    # PWA アイコン 192×192（木材背景＋迷路柄）
│   └── icon-512.png    # PWA アイコン 512×512（同上）
└── labyrinth_context*.md  # 本ドキュメント
```

### manifest.json 主要設定

```json
{
  "name": "木製ラビリンス迷宮バランスゲーム",
  "short_name": "ラビリンス",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#d4b06a",
  "theme_color": "#5c2e0e"
}
```

### index.html の PWA 関連 head タグ（確認済み）

```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#5c2e0e">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ラビリンス">
<link rel="apple-touch-icon" href="icons/icon-192.png">
```

### sw.js キャッシュ対象

```javascript
const CACHE = 'labyrinth-v3';  // UI大改修(2026-06-03)でv3に更新
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
```

### アイコン再生成方法（Python 標準ライブラリのみ）

icons/ フォルダを削除してしまった場合は以下のスクリプトで再生成可能：

```bash
cd <リポジトリルート>
python3 - << 'EOF'
import struct, zlib, os

def make_png(w, h, pixels):
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = b''.join(b'\x00' + bytes([v for px in row for v in px]) for row in pixels)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))

def draw_icon(size):
    BG=(212,176,106); FRAME=(92,46,14); WALL=(140,90,35)
    BALL=(225,225,235); SHINE=(255,255,255); GOAL=(34,160,34)
    px = [[BG]*size for _ in range(size)]
    def rect(x1,y1,x2,y2,c):
        for y in range(max(0,y1),min(size,y2)):
            for x in range(max(0,x1),min(size,x2)): px[y][x]=c
    def circle(cx,cy,r,c,ic=None,ir=0):
        for y in range(max(0,cy-r),min(size,cy+r+1)):
            for x in range(max(0,cx-r),min(size,cx+r+1)):
                d2=(x-cx)**2+(y-cy)**2
                if d2<=r*r: px[y][x]=(ic if ic and d2<=ir*ir else c)
    s=size; b=max(6,s*6//100); wt=max(3,s*4//100); m=max(10,s*16//100)
    rect(0,0,s,b,FRAME); rect(0,s-b,s,s,FRAME)
    rect(0,0,b,s,FRAME); rect(s-b,0,s,s,FRAME)
    rect(b+m,s//2-wt//2,s//2+m,s//2+wt//2+1,WALL)
    rect(s//2+m-wt//2,b+m,s//2+m+wt//2+1,s//2+m,WALL)
    rect(s//2-m,s//2+m-wt//2,s-b-m,s//2+m+wt//2+1,WALL)
    rect(s//2-m-wt//2,s//2-m,s//2-m+wt//2+1,s-b-m,WALL)
    br=max(5,s*8//100); bx=b+m+br+max(2,s//40); by=b+m+br+max(2,s//40)
    circle(bx,by,br,BALL,SHINE,max(1,br//3))
    gr=max(5,s*9//100); gx=s-b-m-gr-max(2,s//40); gy=s-b-m-gr-max(2,s//40)
    circle(gx,gy,gr,GOAL); circle(gx-gr//4,gy-gr//4,max(1,gr//4),(180,220,180))
    return px

os.makedirs('icons', exist_ok=True)
for size in [192, 512]:
    with open(f'icons/icon-{size}.png', 'wb') as f:
        f.write(make_png(size, size, draw_icon(size)))
    print(f'Created icons/icon-{size}.png')
EOF
```

### PWA インストール要件チェックリスト

- [ ] HTTPS でホスティングされている（GitHub Pages / Vercel / Netlify 等）
- [x] `manifest.json` が正しく読み込まれている
- [x] Service Worker (`sw.js`) が登録されている
- [x] 192×192 以上の PNG アイコンが存在する
- [x] `start_url` がアクセス可能なパスになっている

---

## 13. 今後のアイデア（未実装）

- [ ] **Stage 34〜**: さらに高難易度ステージ（difficulty 28+）
- [ ] **BGM**：Web Audio API で環境音（木のきしみ・環境SEなど）
- [ ] **PWAアイコン差し替え**：本物の木製ラビリンスボードの写真への変更（ファイルパス提供待ち）
- [ ] **移動する壁**：往復する柵ギミックのステージ
- [ ] **タイムアタックモード**：全ステージ通しのタイム計測・ランキング
- [ ] **リプレイ保存**：クリア後に軌跡を再生
- [ ] **難易度選択**：簡単/普通/難しいで穴サイズや摩擦を変える
- [ ] **本物BRIO配置ステージ**：83穴番号順の本家マップ再現
- [x] ~~モバイル最適化：タッチ操作の感度チューニング~~ → ドロワー内スライダーで実装済み
- [x] ~~デバッグ非表示~~ → CSS `display:none!important` で実装済み
- [x] ~~360°バーチャルパッド~~ → アナログジョイスティック実装済み
- [x] ~~ハンバーガーメニュー~~ → ドロワーUI実装済み
- [x] ~~タイトル/スタート画面~~ → 実装済み
- [x] ~~ステージロックシステム~~ → localStorage永続化で実装済み

---

*最終更新: 2026-06-03 / 担当AI: Claude (Claude Code) / 対応バージョン: Stage 33まで（全ステージ動作確認済み・PWA対応済み・UI大改修済み）*
