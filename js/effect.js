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
    glow: {
        label: 'Neon（発光）',
        drawText(ctx, { text, x, y, fillStyle, glowColor, frameCount }) {
            // sin波で0〜1を滑らかに往復させ、呼吸するような発光を作る
            const pulse = (Math.sin(frameCount * 0.04) + 1) / 2;
            const blur  = 6 + pulse * 18; // 発光の強さ（弱い⇔強いを繰り返す）

            ctx.save();
            ctx.shadowColor = glowColor;
            ctx.shadowBlur  = blur;
            ctx.fillStyle   = fillStyle;
            ctx.fillText(text, x, y);
            ctx.fillText(text, x, y); // 発光を強調するため重ね塗り
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
