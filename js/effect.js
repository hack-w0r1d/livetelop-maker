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
// 背景エフェクト定義（今後追加）
// ─────────────────────────────────────────
export const BG_EFFECTS = {
    none: {
        label: 'なし',
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
// 背景エフェクト描画（今後、BG_EFFECTSの実装に合わせて拡張）
// ─────────────────────────────────────────
export function drawBackgroundEffect(ctx, effectKey, params) {
    const effect = BG_EFFECTS[effectKey];
    if (!effect || !effect.draw) return;
    effect.draw(ctx, params);
}
