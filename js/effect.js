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
};

// ─────────────────────────────────────────
// 背景エフェクト用ユーティリティ
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// 背景エフェクト定義
// ─────────────────────────────────────────
// init: テロップ作成開始時に1回だけ呼ばれ、星の配置などを生成する（毎フレームでは呼ばない）
// draw: 毎フレーム呼ばれる。initの戻り値をeffectDataとして受け取る
export const BG_EFFECTS = {
    none: {
        label: 'なし',
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
