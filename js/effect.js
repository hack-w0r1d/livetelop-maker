// ─────────────────────────────────────────
// カラーユーティリティ
// ─────────────────────────────────────────
function hexToRgb(hex) {
    const clean  = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8)  & 255,
        b: bigint & 255,
    };
}

function averageHexColors(hex1, hex2) {
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    const r = Math.round((c1.r + c2.r) / 2);
    const g = Math.round((c1.g + c2.g) / 2);
    const b = Math.round((c1.b + c2.b) / 2);
    return `rgb(${r}, ${g}, ${b})`;
}

// グラデーション時は2色の中間色を発光色として使う
export function resolveGlowColor(gradientType, textColor, color1, color2) {
    if (gradientType === 'none') return textColor;
    return averageHexColors(color1, color2);
}

// ─────────────────────────────────────────
// 文字エフェクト定義
// ─────────────────────────────────────────
// drawText:     Canvas描画時に呼ばれる（テロップ動画生成用）
export const TEXT_EFFECTS = {
    none: {
        label: 'なし',
    },
    flame: {
        label: 'Flame（炎）',

        // 文字色・グラデーションの選択に関わらず、専用の炎カラーで描画する
        drawText(ctx, { text, x, y, frameCount }) {
            const metrics = ctx.measureText(text);
            const ascent  = metrics.actualBoundingBoxAscent  || 32;
            const descent = metrics.actualBoundingBoxDescent || 8;

            // グラデーション位置
            const shift = Math.sin(frameCount * 0.04) * (ascent * 0.15);

            const gradient = ctx.createLinearGradient(
                x,
                y + descent + shift,
                x,
                y - ascent + shift
            );

            // 色境界をゆっくり揺らす
            const orangeStop =
                0.45 +
                Math.sin(frameCount * 0.08) * 0.04 +
                Math.sin(frameCount * 0.15) * 0.02;

            gradient.addColorStop(0.00, '#ff2200');
            gradient.addColorStop(orangeStop, '#ff8800');
            gradient.addColorStop(0.78, '#ffdd33');
            gradient.addColorStop(1.00, '#fff8bb');

            // 発光のちらつき
            const flicker =
                Math.sin(frameCount * 0.34) * 0.5 +
                Math.sin(frameCount * 0.19) * 0.35 +
                Math.sin(frameCount * 0.73) * 0.15;

            const glow = 12 + Math.abs(flicker) * 12;

            // 上側だけ熱で揺れる
            const topWave =
                Math.sin(frameCount * 0.18) * 1.4 +
                Math.sin(frameCount * 0.11) * 0.8;

            ctx.save();

            ctx.shadowColor = '#ff5500';
            ctx.shadowBlur = glow;

            ctx.fillStyle = gradient;

            // ベース文字
            ctx.fillText(text, x, y);

            // 上側だけ少しずらして描くことで炎っぽく
            ctx.save();
            ctx.beginPath();
            ctx.rect(
                x - 20,
                y - ascent - 10,
                metrics.width + 40,
                ascent * 0.6
            );
            ctx.clip();

            ctx.globalAlpha = 0.55;
            ctx.fillText(
                text,
                x + Math.sin(frameCount * 0.25) * 0.6,
                y - topWave
            );
            ctx.restore();

            // 発光を少し強調
            ctx.globalAlpha = 0.35;
            ctx.fillText(text, x, y);

            ctx.restore();
        },
    },
    neon: {
        label: 'Neon（発光）',
        drawText(ctx, { text, x, y, fillStyle, glowColor, frameCount }) {
            // sin波で0〜1を滑らかに往復させ、呼吸するような発光を作る
            const pulse = (Math.sin(frameCount * 0.028) + 1) / 2;
            const blur = 4 + pulse * 18; // 発光の強さ（弱い⇔強いを繰り返す）

            ctx.save();

            // 発光色
            ctx.shadowColor = glowColor;

            // 外側の柔らかい光
            ctx.shadowBlur = blur;
            ctx.fillStyle = glowColor;
            ctx.fillText(text, x, y);

            // 中間の光
            ctx.shadowBlur = blur * 0.6;
            ctx.fillText(text, x, y);

            // 内側の強い光
            ctx.shadowBlur = blur * 0.3;
            ctx.fillText(text, x, y);

            ctx.shadowBlur = 0;
            ctx.fillStyle = fillStyle;
            ctx.fillText(text, x, y);

            ctx.restore();
        },
    },
};

// ─────────────────────────────────────────
// 背景エフェクト用ユーティリティ
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// Celebration（祝福）用ヘルパー
// ─────────────────────────────────────────
const CONFETTI_COLORS = [
    '255,90,90',   // 赤
    '255,200,60',  // 黄
    '90,190,255',  // 青
    '120,220,120', // 緑
    '255,130,220', // ピンク
    '190,130,255', // 紫
    '255,255,255', // 白
];

function degToRad(deg) { return (deg * Math.PI) / 180; }

// クラッカーが画面端からどれだけ出っ張るか（水平位置）
const CRACKER_MARGIN      = 18; // 画面端からの水平オフセット
const CRACKER_CONE_LENGTH = 34; // コーンの長さ（持ち手～発射口）
const CRACKER_REST_MARGIN = 6;  // 静止時、持ち手側が画面下端からどれだけ内側に収まるか
const CRACKER_MOUTH_WIDTH  = 22; // 発射口（大きい側）の幅
const CRACKER_ANCHOR_WIDTH = 6;  // 持ち手（小さい側）の幅
const CRACKER_ANGLE = degToRad(73);

// クラッカーの出現タイムライン（トリガーされてからの相対フレーム数）
// ゆっくりせり上がり、コーン全体がテロップ内に収まったところで一旦止まって祝砲を打つ
const CRACKER_PEEK_IN_END  = 26; // 0〜26: ゆっくりせり上がる
const CRACKER_FIRE_FRAME   = 30; // 30: 全体が画面内に収まり静止した直後に祝砲を打つ（1回だけ）
const CRACKER_HOLD_END     = 48; // 30〜48: 出たまま静止
const CRACKER_PEEK_OUT_END = 66; // 48〜66: ひょこっと隠れる

function makeCrackerState(side) {
    return { side, triggered: false, fired: false, startFrame: 0 };
}

// クラッカーの持ち手（小さい側・隠れる側）のy座標
// reveal: 0=完全に隠れている 〜 1=コーン全体が画面内に収まる静止位置
function crackerAnchorY(height, reveal) {
    const hiddenY = height + CRACKER_CONE_LENGTH + 12; // 完全に隠れている位置
    const restY   = height - CRACKER_REST_MARGIN;      // コーン全体が画面内に収まる位置
    return hiddenY + (restY - hiddenY) * reveal;
}

// クラッカーの向いている方向ベクトル（発射方向）
function crackerDirection(side) {
    const dir = side === 'left' ? 1 : -1;
    const angle = dir * CRACKER_ANGLE;
    return {
        x: Math.sin(angle),
        y: -Math.cos(angle),
    };
}

// クラッカーの発射口（大きい側＝紙吹雪の発射位置）が静止時に来る座標
function crackerMouthPosition(side, width, height) {
    const dir = side === 'left' ? 1 : -1;
    const anchorX = side === 'left' ? CRACKER_MARGIN : width - CRACKER_MARGIN;
    const anchorY = crackerAnchorY(height, 1);
    const d = crackerDirection(side);
    return {
        x: anchorX + d.x * CRACKER_CONE_LENGTH,
        y: anchorY + d.y * CRACKER_CONE_LENGTH,
    };
}

// 紙吹雪の1片を生成する
// originX/originYを指定すると、その位置から初速つきで飛び出す「祝砲」パーティクルになる。
// 指定しない場合は画面上部から自然に降ってくるアンビエントな紙吹雪になる
function spawnConfettiPiece(width, originX = null, originY = null, initialVel = null) {
    const isBurst = originX !== null;
    const isRibbon = isBurst && Math.random() < 0.4;
    return {
        x: isBurst ? originX : Math.random() * width,
        y: isBurst ? originY : -10 - Math.random() * 60,
        vx: isBurst ? initialVel.vx : (Math.random() - 0.5) * 0.6,
        vy: isBurst ? initialVel.vy : 0.6 + Math.random() * 0.8,
        isRibbon,
        w: isRibbon ? 2 + Math.random() * 1 : 4 + Math.random() * 3,
        h: isRibbon ? 30 + Math.random() * 70 : 7 + Math.random() * 4,
        rotation: isBurst ? Math.atan2(initialVel.vy, initialVel.vx) + Math.PI / 2 : Math.random() * Math.PI * 2,
        rotationDelay: isBurst ? 35 + Math.random() * 15 : 0,
        rotSpeed: isBurst ? (Math.random() - 0.5) * 0.05 : (Math.random() - 0.5) * 0.3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        swayPhase: Math.random() * Math.PI * 2,
        swaySpeed: 0.03 + Math.random() * 0.05,
        swayAmount: isBurst ? 0.8 + Math.random() * 0.8 : 0.3 + Math.random() * 0.5,
        wavePhase: Math.random() * Math.PI * 2,
        waveSpeed: 0.12 + Math.random() * 0.05,
        waveDelay: 1 + Math.random() * 15,
        age: 0,
        gravity: isBurst ? 0.028 : 0.012,
        drag: isBurst ? 0.985 : 0.995,
    };
}

// 紙吹雪1片の物理更新＋描画。falseを返したら画面外なので破棄する
function updateAndDrawConfettiPiece(ctx, c, height) {
    c.vy += c.gravity;
    c.vx *= c.drag;
    c.vy *= c.drag;
    c.swayPhase += c.swaySpeed;
    if (c.isRibbon) {
        c.wavePhase += c.waveSpeed;
    }
    c.age ++;
    c.x += c.vx + Math.sin(c.swayPhase) * c.swayAmount;
    c.y += c.vy;
    if (c.age > c.rotationDelay) {
        c.rotation += c.rotSpeed;
    }

    if (c.isRibbon) {
        const speed = Math.hypot(c.vx, c.vy);
            // 速度が落ちるほど波打ちを強くする
        if (c.age > c.waveDelay) {
            const waveProgress = Math.min(1, (c.age - c.waveDelay) / 30);
            c.waveAmount = (0.8 + (7 - Math.min(speed, 7)) * 0.35) * waveProgress;
        } else {
            c.waveAmount = 0;
        }
    }

    // 回転に応じて紙片の見かけの幅を伸縮させ、ひらひらと裏返る質感を出す
    const flutter = Math.max(0.12, Math.abs(Math.cos(c.rotation)));

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rotation);

    if (c.isRibbon) {
        // -----------------------------
        // 祝砲のリボン（波打つ）
        // -----------------------------
        ctx.strokeStyle = `rgba(${c.color}, 0.9)`;
        ctx.lineWidth = c.w;
        ctx.lineCap = 'round';
        ctx.beginPath();

        const segments = 6;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const y = -c.h / 2 + c.h * t;
            const x = Math.sin(c.wavePhase + t * Math.PI * 2) * c.waveAmount;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    } else {
        // 通常の紙吹雪
        ctx.fillStyle = `rgba(${c.color}, 0.9)`;
        ctx.fillRect((-c.w * flutter) / 2, -c.h / 2, Math.max(0.6, c.w * flutter), c.h);
    }

    ctx.restore();

    return c.y < height + 20;
}

// クラッカーの祝砲
function fireCracker(effectData, side, width, height) {
    const { x, y } = crackerMouthPosition(side, width, height);
    const d = crackerDirection(side);
    for (let i = 0; i < 20; i++) {
        // 扇状に少しだけ広げる
        const spread = (Math.random() - 0.5) * 0.5;
        const dx = d.x + (-d.y) * spread;
        const dy = d.y + ( d.x) * spread;
        const len = Math.hypot(dx, dy);
        const speed = 6.5 + Math.random() * 1.5;
        effectData.confetti.push(
            spawnConfettiPiece(width, x, y, {
                vx: (dx / len) * speed,
                vy: (dy / len) * speed,
            })
        );
    }
}

// クラッカー本体（コーン状）を描画する。大きい側が発射口。reveal: 0=隠れている 〜 1=静止位置
function drawCrackerShape(ctx, side, reveal, width, height) {
    if (reveal <= 0) return;

    const dir     = side === 'left' ? 1 : -1;
    const baseX   = side === 'left' ? CRACKER_MARGIN : width - CRACKER_MARGIN;
    const anchorY = crackerAnchorY(height, reveal); // 持ち手（小さい側）の位置

    ctx.save();
    ctx.translate(baseX, anchorY);
    ctx.rotate(dir * CRACKER_ANGLE); // 祝砲の発射方向に合わせて傾ける

    // 持ち手（小さい側・ローカルy=0）から発射口（大きい側・ローカルy=-coneLength）へ伸びるコーン
    const grad = ctx.createLinearGradient(0, 0, 0, -CRACKER_CONE_LENGTH);
    grad.addColorStop(0, '#d9a441');
    grad.addColorStop(1, '#fff1b8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-CRACKER_ANCHOR_WIDTH / 2, 0);
    ctx.lineTo(CRACKER_ANCHOR_WIDTH / 2, 0);
    ctx.lineTo(CRACKER_MOUTH_WIDTH / 2, -CRACKER_CONE_LENGTH);
    ctx.lineTo(-CRACKER_MOUTH_WIDTH / 2, -CRACKER_CONE_LENGTH);
    ctx.closePath();
    ctx.fill();

    // 帯模様
    ctx.strokeStyle = 'rgba(255,60,90,0.85)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 2; i++) {
        const yy = -(CRACKER_CONE_LENGTH / 3) * i;
        const w  = CRACKER_ANCHOR_WIDTH + (CRACKER_MOUTH_WIDTH - CRACKER_ANCHOR_WIDTH) * (-yy / CRACKER_CONE_LENGTH);
        ctx.beginPath();
        ctx.moveTo(-w / 2, yy);
        ctx.lineTo(w / 2, yy);
        ctx.stroke();
    }

    // 発射口のハイライト（大きい開口部）
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(0, -CRACKER_CONE_LENGTH, CRACKER_MOUTH_WIDTH / 2, CRACKER_MOUTH_WIDTH / 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// クラッカー1本分の状態更新＋描画（出現→発射→静止→退場）
function updateAndDrawCracker(ctx, effectData, cracker, frameCount, width, height) {
    if (!cracker.triggered) return;
    const t = frameCount - cracker.startFrame;
    if (t > CRACKER_PEEK_OUT_END) return;

    if (!cracker.fired && t >= CRACKER_FIRE_FRAME) {
        cracker.fired = true;
        fireCracker(effectData, cracker.side, width, height);
        // 最初（左）のクラッカーが発射したら、紙吹雪が舞い落ちるエフェクトへ入る
        if (cracker.side === 'left') {
            effectData.confettiActive = true;
        }
    }

    let reveal;
    if (t < CRACKER_PEEK_IN_END) {
        const p = t / CRACKER_PEEK_IN_END;
        reveal = 1 - (1 - p) * (1 - p); // ease-out: 勢いよく出てゆっくり止まる
    } else if (t < CRACKER_HOLD_END) {
        reveal = 1;
    } else {
        const p = (t - CRACKER_HOLD_END) / (CRACKER_PEEK_OUT_END - CRACKER_HOLD_END);
        reveal = Math.max(0, 1 - p * p); // ease-in: ゆっくり隠れ始めて引っ込む
    }

    drawCrackerShape(ctx, cracker.side, reveal, width, height);
}

// 花火の色バリエーション（RGB文字列。rgba()に直接埋め込んで使う）
const FIREWORK_COLORS = [
    '255,74,74',    // red
    '66,245,138',   // green
    '255,217,61',   // yellow
    '46,107,255',   // blue
    '255,107,223',  // pink
    '83,232,255',   // cyan
    '255,140,46',   // orange
];

// 打ち上げロケットを1個生成する（正方形ドットを刻みながら上昇＝走査線のイメージ）
function spawnFireworkRocket(width, height) {
    return {
        x: width * (0.15 + Math.random() * 0.7),
        y: height + 10,
        // 爆発する高さ（画面上側15%〜50%あたり）
        targetY: height * (0.15 + Math.random() * 0.35),
        vx: (Math.random() - 0.5) * 0.4, // わずかに左右へブレる
        vy: -(2.8 + Math.random() * 1.0), // 上昇速度
        trail: [], // 軌跡（古い位置ほど薄く描く）
        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
    };
}

// 爆発の破片を1個生成する。
// 角度をsectorCount方向に均等分割してからジッターを加えることで、
// 完全ランダムではなく「規則的に割れる基盤」のような広がり方にする。
// 序盤(rayUntilまで)は爆発中心からの直線（光条）として描き、
// それ以降は軌跡をポリラインで繋いだ尾として描く（点ではなく線で表現する）。
// isEmberがtrueの場合は「燃え殻」として長寿命・尾長めにし、柳咲きのような余韻を残す
function spawnFireworkParticle(x, y, color, sectorAngle, sectorIndex, isEmber) {
    const jitter = (Math.random() - 0.5) * sectorAngle * 0.5;
    const angle  = sectorAngle * sectorIndex + jitter;
    // 速度をなめらかな乱数ではなく数段階に量子化（デジタルな「刻み」感を出す）。
    const speedTiers = isEmber
        ? [0.7, 0.9, 1.2, 1.5] // エンバーは少し遠くまで飛ばして広がりを出す
        : [0.4, 0.6, 0.8, 1.0];
    const speed = speedTiers[Math.floor(Math.random() * speedTiers.length)];
    return {
        x, y,
        originX: x, // 爆発中心（rayフェーズの線の起点として保持）
        originY: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2.2 + Math.floor(Math.random() * 3), // 線の太さ計算に使う基準サイズ
        life: isEmber ? 150 + Math.random() * 90 : 100 + Math.random() * 60,
        age: 0,
        trail: [],
        isEmber,
        // 明滅の位相。sin波ではなくON/OFFの矩形波で点滅させる
        blinkOffset: Math.floor(Math.random() * 6),
        // このフレーム数までは「中心からの直線」＋明滅で描画し、
        // 以降は軌跡ポリラインのなめらかな尾に切り替える
        rayUntil: 40 + Math.random() * 20,
        // 中心付近の空白（放射が見え始めるまでの距離）を個体ごとにばらけさせる。
        holeRadius: 2 + Math.random() * 10,
    };
}

function spawnCrackle(x, y, color) {
    return {
        x,
        y,
        color,
        age: 0,
        life: 14 + Math.floor(Math.random() * 12),
        blinkOffset: Math.floor(Math.random() * 4),
    };
}

// 火の粉を1個生成する
function spawnSpark(width, height) {
    return {
        x: width * Math.random(),
        y: height + Math.random() * 15,
        // 初期位置
        startY: height,
        // 左右移動
        vx: (Math.random() - 0.5) * 0.3,
        // 上昇速度（個体差を大きめに）
        vy: -(0.3 + Math.random() * 1.0),
        // サイズ
        radius: 0.8 + Math.random() * 1.6,
        // 寿命
        life: 50 + Math.random() * 70,
        age: 0,
        // 揺れ用
        phase: Math.random() * Math.PI * 2,
        waveSpeed: 0.05 + Math.random() * 0.12,
        waveAmount: 0.15 + Math.random() * 0.35,
    };
}

// ステージライトの光源を1つ生成する
function makeStageLightFixture(x, y, angle, color, alpha, length, sweepRange, sweepSpeed, phase = Math.random() * Math.PI * 2) {
    return {
        x, y,
        baseAngle:  angle,
        sweepRange: sweepRange + Math.random() * sweepRange * 0.3, // 個体差
        sweepSpeed: sweepSpeed + Math.random() * sweepSpeed * 0.3,
        phase,
        spread:     0.045 + Math.random() * 0.015, // ビームの太さ
        length,
        color,
        alpha,
    };
}

// 四芒星（スパークル）のパスを構築する。呼び出し側でfillStyle設定後にctx.fill()すること
function buildFourPointStarPath(ctx, cx, cy, outerRadius) {
    const innerRadius = outerRadius * 0.25; // 細い棘にするため小さめの比率
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angle  = (Math.PI / 4) * i - Math.PI / 2; // 上（12時方向）から開始
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

// ─────────────────────────────────────────
// 背景エフェクト定義
// ─────────────────────────────────────────
// init: テロップ作成開始時に1回だけ呼ばれ、星の配置などを生成する（毎フレームでは呼ばない）
// draw: 毎フレーム呼ばれる。initの戻り値をeffectDataとして受け取る
export const BG_EFFECTS = {
    none: {
        label: 'なし',
    },
    celebration: {
        label: 'Celebration（祝福）',
        init(width, height) {
            return {
                width,
                height,
                confetti: [],
                confettiActive: false,
                nextConfettiFrame: 0,
                leftCracker:  makeCrackerState('left'),
                rightCracker: makeCrackerState('right'),
            };
        },
        // textX/textWidth: 現在のテキストのx座標と幅（telop.jsから渡される）。
        // テキストの先頭がtextX、末尾がtextX + textWidthの位置になる
        draw(ctx, { effectData, frameCount, textX = 0, textWidth = 0 }) {
            const { width, height } = effectData;
            const triggerX = width * (2 / 3);

            // 文字の先頭がテロップ中央に到達 → 左下からクラッカー登場
            if (!effectData.leftCracker.triggered && textX <= triggerX) {
                effectData.leftCracker.triggered = true;
                effectData.leftCracker.startFrame = frameCount;
            }
            // 文字の末尾がテロップ中央に到達 → 右下からクラッカー登場
            if (!effectData.rightCracker.triggered && textX + textWidth <= triggerX) {
                effectData.rightCracker.triggered = true;
                effectData.rightCracker.startFrame = frameCount;
            }

            // 紙吹雪の継続的なスポーン（左クラッカーの祝砲後に有効化）
            if (effectData.confettiActive && frameCount >= effectData.nextConfettiFrame) {
                effectData.confetti.push(spawnConfettiPiece(width));
                effectData.nextConfettiFrame = frameCount + 2 + Math.random() * 3;
            }

            // 紙吹雪（アンビエント＋祝砲）の更新・描画
            effectData.confetti = effectData.confetti.filter((c) => updateAndDrawConfettiPiece(ctx, c, height));

            // クラッカー本体の更新・描画（紙吹雪より手前に重ねる）
            updateAndDrawCracker(ctx, effectData, effectData.leftCracker, frameCount, width, height);
            updateAndDrawCracker(ctx, effectData, effectData.rightCracker, frameCount, width, height);
        },
    },
    fireworks: {
        label: 'Fireworks（デジタル）',
        init(width, height) {
            return {
                width,
                height,
                rockets: [],
                particles: [],
                crackles: [],
                // 最初の1発が上がるまでの待ち時間
                nextLaunchFrame: 20 + Math.random() * 40,
            };
        },
        draw(ctx, { effectData, frameCount }) {
            const { width, height } = effectData;

            // 打ち上げタイミング管理（一定間隔でランダムに発射、たまに2連発）
            if (frameCount >= effectData.nextLaunchFrame) {
                effectData.rockets.push(spawnFireworkRocket(width, height));
                if (Math.random() < 0.25) {
                    effectData.rockets.push(spawnFireworkRocket(width, height));
                }
                effectData.nextLaunchFrame = frameCount + 55 + Math.random() * 70;
            }

            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; // 加算合成で発光を重ねる

            // ロケット（上昇中）の更新・描画
            effectData.rockets = effectData.rockets.filter((rocket) => {
                rocket.trail.push({ x: rocket.x, y: rocket.y });
                if (rocket.trail.length > 8) rocket.trail.shift();

                rocket.x += rocket.vx;
                rocket.y += rocket.vy;
                rocket.vy *= 0.99; // わずかに減速

                // 走査線のような尾
                rocket.trail.forEach((pt, i) => {
                    const a = (i / rocket.trail.length) * 0.6;
                    ctx.fillStyle = `rgba(${rocket.color}, ${a})`;
                    ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
                });

                // 先端の光
                ctx.fillStyle = `rgba(${rocket.color}, 0.95)`;
                ctx.fillRect(rocket.x - 1.5, rocket.y - 1.5, 3, 3);

                // 頂点到達（または勢いが尽きた）ら爆発してロケットは消滅
                if (rocket.y <= rocket.targetY || rocket.vy > -0.5) {
                    // 方向をsectorCount等分にして規則的に割れさせる（密度を上げてボリューム感を出す）
                    const sectorCount = 14 + Math.floor(Math.random() * 8); // 14〜21方向
                    const sectorAngle = (Math.PI * 2) / sectorCount;
                    for (let i = 0; i < sectorCount; i++) {
                        // 1方向あたり4〜5粒。最後の1粒だけ尾を引くエンバーにして余韻を残す
                        const grains = 4 + Math.floor(Math.random() * 2);
                        for (let g = 0; g < grains; g++) {
                            const isEmber = g === grains - 1;
                            effectData.particles.push(
                                spawnFireworkParticle(rocket.x, rocket.y, rocket.color, sectorAngle, i, isEmber)
                            );
                        }
                    }
                    return false;
                }
                return true;
            });

            // 爆発パーティクルの更新・描画（正方形ドット＋ON/OFFの矩形波で明滅）
            effectData.particles = effectData.particles.filter((p) => {
                p.age++;
                // エンバー（尾を引くタイプ）は重力を強めにして柳が垂れるように落とす。
                const gravity = p.isEmber ? 0.02 : 0.012;
                const drag    = p.isEmber ? 0.992 : 0.98; // 空気抵抗は弱めにして軌跡を長く見せる
                p.vy += gravity;
                p.vx *= drag;
                p.vy *= drag;

                // エンバーは尾を長めに残して余韻を出す
                const trailMax = p.isEmber ? 9 : 5;
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > trailMax) p.trail.shift();

                p.x += p.vx;
                p.y += p.vy;

                const t = p.age / p.life;
                let alpha = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / 0.9);

                ctx.lineCap = 'round';

                if (p.age < p.rayUntil) {
                    // 序盤：爆発中心から現在位置まで直線を引く。
                    // 中心から少し離れた位置を始点にし、中心付近には空白を残す。
                    // 距離は個体ごとのholeRadiusを使い、綺麗な円にならないようにばらつかせる
                    const dx = p.x - p.originX;
                    const dy = p.y - p.originY;
                    const dist = Math.hypot(dx, dy) || 1;
                    const holeRadius = Math.min(p.holeRadius, dist);
                    const startX = p.originX + (dx / dist) * holeRadius;
                    const startY = p.originY + (dy / dist) * holeRadius;
                    const blinkStart = p.rayUntil * 0.9;
                    let blink = 1;
                    if (p.age > blinkStart) {
                        blink = Math.floor((p.age - blinkStart) / 3 + p.blinkOffset) % 2 === 0 ? 1 : 0.25;
                    }
                    const rayAlpha = alpha * blink;

                    // 中心側(始点)を透明、先端側(現在位置)を通常alphaにするグラデーション。
                    // 線が伸びるほど中心寄りの部分が透明になり、先端に光が集まって
                    // 外へ向かって放射している印象になる
                    const rayGradient = ctx.createLinearGradient(startX, startY, p.x, p.y);
                    rayGradient.addColorStop(0, `rgba(${p.color}, 0)`);
                    rayGradient.addColorStop(1, `rgba(${p.color}, ${rayAlpha})`);

                    ctx.beginPath();
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(p.x, p.y);
                    ctx.strokeStyle = rayGradient;
                    ctx.lineWidth = p.isEmber ? 2.4 : 1.8;
                    ctx.stroke();
                } else {
                    // 後半：軌跡をポリラインで繋いだ尾に切り替える。
                    // 重力で曲がった軌道もそのまま滑らかな曲線として残る
                    for (let i = 1; i < p.trail.length; i++) {
                        const segAlpha = alpha * (i / p.trail.length) * 0.85;
                        ctx.beginPath();
                        ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
                        ctx.lineTo(p.trail[i].x, p.trail[i].y);
                        ctx.strokeStyle = `rgba(${p.color}, ${segAlpha})`;
                        ctx.lineWidth = p.isEmber ? 2 : 1.4;
                        ctx.stroke();
                    }

                    // エンバーはランダムなタイミングで一瞬白く強く光る「きらめき」を重ねる
                    if (p.isEmber && Math.random() < 0.12) {
                        const s = 3;
                        const sparkleAlpha = alpha * (0.75 + Math.random() * 0.25);
                        ctx.strokeStyle = `rgba(255,255,255, ${sparkleAlpha})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(p.x - s, p.y);
                        ctx.lineTo(p.x + s, p.y);
                        ctx.moveTo(p.x, p.y - s);
                        ctx.lineTo(p.x, p.y + s);
                        ctx.stroke();
                    }
                }

                if (p.age >= p.life) {
                    // 寿命が尽きた場所に明滅する残光を残す
                    effectData.crackles.push(spawnCrackle(p.x, p.y, p.color));
                    return false;
                }
                return true;
            });

            // 最後のきらめき
            effectData.crackles = effectData.crackles.filter((c) => {
                c.age++;
                const t = c.age / c.life;
                const fade = Math.max(0, 1 - t); // 消え際に向けてだんだん儚く

                // 明滅の周期を消え際にかけて少しずつ長くして、静かに収める
                const period = 2 + Math.floor(t * 3);
                const isOn = Math.floor((c.age + c.blinkOffset) / period) % 2 === 0;

                if (isOn) {
                    const r = 1.4 + Math.random() * 1.2;
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(${c.color}, ${fade})`;
                    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
                    ctx.fill();
                }

                return c.age < c.life;
            });

            ctx.restore();
        },
    },
    sparks: {
        label: 'Sparks（火の粉）',
        init(width, height) {
            const particles = [];
            for (let i = 0; i < 24; i++) {
                particles.push(spawnSpark(width, height));
            }
            // draw()側でリスポーン時に再利用するため、幅と高さも一緒に保持する
            return { width, height, particles };
        },
        draw(ctx, { effectData }) {
            const { width, height, particles } = effectData;

            particles.forEach((spark) => {
                spark.age++;
                // 少し減速
                spark.vy *= 0.997;
                spark.y += spark.vy;
                // 左右にふわふわ
                spark.x +=
                    spark.vx +
                    Math.sin(
                        spark.phase +
                        spark.age * spark.waveSpeed
                    ) * spark.waveAmount;

                // フェードインは早め、フェードアウトは緩やかに
                const t = spark.age / spark.life;
                const alpha = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
                // 上に行くほど小さく
                const r = spark.radius * (1 - t * 0.45);
                // 色温度変化
                let color;

                if (t < 0.25) {
                    color = '255,160,50';
                } else if (t < 0.55) {
                    color = '255,110,30';
                } else if (t < 0.8) {
                    color = '230,55,20';
                } else {
                    color = '130,20,10';
                }

                // 外側の発光
                const gradient = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, r * 4.3);
                gradient.addColorStop(0, `rgba(${color},${alpha})`);
                gradient.addColorStop(1, `rgba(${color},0)`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(spark.x, spark.y, r * 4.3, 0, Math.PI * 2);
                ctx.fill();
                // 明るい芯
                ctx.beginPath();
                ctx.fillStyle =`rgba(255,255,220,${alpha})`;
                ctx.arc(spark.x, spark.y, Math.max(0.4, r), 0, Math.PI * 2);
                ctx.fill();

                // 寿命が尽きた、または画面外に出たら再生成
                if (spark.age >= spark.life || spark.y < -20 || spark.x < -20 || spark.x > width + 20) {
                    Object.assign(spark, spawnSpark(width, height));
                }
            });
        },
    },
    stageLights: {
        label: 'Stage Lights（ライブ照明）',
        init(width, height) {
            const length = Math.sqrt(width * width + height * height) * 1.1;
            const fixtures = [];

            // 白は控えめに揺らす（スポットとして安定させる）
            const WHITE_SWEEP_RANGE = 0.05;
            const WHITE_SWEEP_SPEED = 0.01;
            // ピンク・ブルーはライブ感を出すため大きく揺らす
            const BLUE_SWEEP_RANGE = 0.55;
            const BLUE_SWEEP_SPEED = 0.035;
            const VIVID_SWEEP_RANGE = 0.4;
            const VIVID_SWEEP_SPEED = 0.03;

            // 左右上角：斜めの白い光。キャンバス中央に向くよう角度を計算し、ステージ中央を照らす
            const centerX = width / 2;
            const centerY = height / 2;
            const leftX = -4, leftY = -4;
            const rightX = width + 4, rightY = -4;
            const targetY = height * 0.72;
            const leftAngle = Math.atan2(targetY - leftY, centerX - width * 0.12 - leftX);
            const rightAngle = Math.atan2(targetY - rightY, centerX + width * 0.12 - rightX);
            const centerAngle = -Math.PI / 2; // 真上
            const blueOffset = 0.6;
            const leftBlueAngle  = centerAngle + blueOffset;
            const rightBlueAngle = centerAngle - blueOffset;

            fixtures.push(makeStageLightFixture(leftX, leftY, leftAngle, '255,255,255', 0.5, length, WHITE_SWEEP_RANGE, WHITE_SWEEP_SPEED));
            fixtures.push(makeStageLightFixture(rightX, rightY, rightAngle, '255,255,255', 0.5, length, WHITE_SWEEP_RANGE, WHITE_SWEEP_SPEED));

            // ピンク・紫を交互に。左1/3エリア下から2本
            fixtures.push(makeStageLightFixture(width * (1 / 3) * 0.3, height + 4, -1.05, '255,60,170', 0.65, length, VIVID_SWEEP_RANGE, VIVID_SWEEP_SPEED));
            fixtures.push(makeStageLightFixture(width * (1 / 3) * 0.7, height + 4, -0.65, '170,60,255', 0.65, length, VIVID_SWEEP_RANGE, VIVID_SWEEP_SPEED));

            // 右1/3エリア下から2本（左の配置を左右反転）
            fixtures.push(makeStageLightFixture(width - width * (1 / 3) * 0.3, height + 4, -Math.PI - (-1.05), '255,60,170', 0.65, length, VIVID_SWEEP_RANGE, VIVID_SWEEP_SPEED));
            fixtures.push(makeStageLightFixture(width - width * (1 / 3) * 0.7, height + 4, -Math.PI - (-0.65), '170,60,255', 0.65, length, VIVID_SWEEP_RANGE, VIVID_SWEEP_SPEED));

            // 中央2/3エリア下：鮮やかな青の光2本
            fixtures.push(makeStageLightFixture(width * (1 / 3) + width * (1 / 3) * 0.3, height + 4, leftBlueAngle, '70,170,255', 0.65, length, BLUE_SWEEP_RANGE, BLUE_SWEEP_SPEED, 0));
            fixtures.push(makeStageLightFixture(width * (1 / 3) + width * (1 / 3) * 0.7, height + 4, rightBlueAngle, '70,170,255', 0.65, length, BLUE_SWEEP_RANGE, BLUE_SWEEP_SPEED, Math.PI));

            return fixtures;
        },
        draw(ctx, { effectData, frameCount }) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter'; // 加算合成で交差部分を明るくする

            effectData.forEach((f) => {
                const angle = f.baseAngle + Math.sin(frameCount * f.sweepSpeed + f.phase) * f.sweepRange;

                const x1 = f.x + Math.cos(angle - f.spread) * f.length;
                const y1 = f.y + Math.sin(angle - f.spread) * f.length;
                const x2 = f.x + Math.cos(angle + f.spread) * f.length;
                const y2 = f.y + Math.sin(angle + f.spread) * f.length;
                const midX = f.x + Math.cos(angle) * f.length;
                const midY = f.y + Math.sin(angle) * f.length;

                const gradient = ctx.createLinearGradient(f.x, f.y, midX, midY);
                gradient.addColorStop(0, `rgba(${f.color}, ${f.alpha})`);
                gradient.addColorStop(1, `rgba(${f.color}, 0)`);

                ctx.beginPath();
                ctx.moveTo(f.x, f.y);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();

                // 光源本体の発光
                const core = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 7);
                core.addColorStop(0, `rgba(${f.color}, ${f.alpha + 0.3})`);
                core.addColorStop(1, `rgba(${f.color}, 0)`);
                ctx.fillStyle = core;
                ctx.beginPath();
                ctx.arc(f.x, f.y, 7, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
        },
    },
    stars: {
        label: 'Stars（星）',
        init(width, height) {
            const count = 40;
            const stars = [];
            for (let i = 0; i < count; i++) {
                stars.push({
                    x:      Math.random() * width,
                    y:      Math.random() * height,
                    radius: Math.random() * 1.2 + 0.5,
                    phase:  Math.random() * Math.PI * 2, // 明滅のタイミングをずらす
                    speed:  0.03 + Math.random() * 0.04, // 明滅の速さのばらつき
                });
            }
            return stars;
        },
        draw(ctx, { effectData, frameCount }) {
            effectData.forEach((star) => {
                const twinkle = (Math.sin(frameCount * star.speed + star.phase) + 1) / 2;
                const alpha = 0.2 + twinkle * 0.8; // 完全に消えないよう下限を設定
                const r     = star.radius * (0.7 + twinkle * 0.6);

                // 周囲の柔らかい光暈
                const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, r * 4);
                glow.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.6})`);
                glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(star.x, star.y, r * 4, 0, Math.PI * 2);
                ctx.fill();

                // 四芒星本体
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                buildFourPointStarPath(ctx, star.x, star.y, r * 3);
                ctx.fill();
            });
        },
    },
};

// ─────────────────────────────────────────
// テキスト描画（エフェクトのディスパッチ）
// telop.jsのdraw()から呼び出す
// ─────────────────────────────────────────
export function drawTextWithEffect(ctx, effectKey, params) {
    const effect = TEXT_EFFECTS[effectKey];

    if (!effect || !effect.drawText) {
        // エフェクトなし（デフォルト描画）
        ctx.fillStyle = params.fillStyle;
        ctx.fillText(params.text, params.x, params.y);
        return;
    }

    effect.drawText(ctx, params);
}

// ─────────────────────────────────────────
// 背景エフェクトの初期化（テロップ作成開始時に1回だけtelop.jsから呼ぶ）
// ─────────────────────────────────────────
export function initBackgroundEffect(effectKey, width, height) {
    const effect = BG_EFFECTS[effectKey];
    if (!effect || !effect.init) return null;
    return effect.init(width, height);
}

// ─────────────────────────────────────────
// 背景エフェクト描画（毎フレーム呼ぶ）
// ─────────────────────────────────────────
export function drawBackgroundEffect(ctx, effectKey, params) {
    const effect = BG_EFFECTS[effectKey];
    if (!effect || !effect.draw) return;
    effect.draw(ctx, params);
}
