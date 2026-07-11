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

// 花火の色バリエーション（デジタル・ネオン系。RGB文字列でrgba()に直接埋め込んで使う）
const FIREWORK_COLORS = [
    '255,74,74',    // Red
    '66,245,138',   // Green
    '255,217,61',   // Yellow
    '46,107,255',   // Blue
    '255,107,223',  // Pink
    '83,232,255',   // Cyan
    '255,140,46',   // Orange
];

// 打ち上げロケットを1個生成する
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

// 爆発の破片（パーティクル）を1個生成する。
// 角度をsectorCount方向に均等分割してからジッターを加えることで、
// 完全ランダムではなく「規則的に割れる基盤」のような広がり方にする。
// isEmberがtrueの場合は「燃え殻」として長寿命・尾長め・後半は明滅せず
// じわっとフェードする（柳咲き花火のような余韻を残す）
function spawnFireworkParticle(x, y, color, sectorAngle, sectorIndex, isEmber) {
    const jitter = (Math.random() - 0.5) * sectorAngle * 0.5;
    const angle  = sectorAngle * sectorIndex + jitter;
    // 速度をなめらかな乱数ではなく数段階に量子化（デジタルな「刻み」感を出す）
    const speedTiers = isEmber
    ? [2.4, 3.2, 4.0, 4.8]
    : [1.3, 1.9, 2.5, 3.1];
    // const speedTiers = isEmber
    //     ? [2.6, 3.4, 4.2, 5.0] // エンバーは少し遠くまで飛ばして広がりを出す
    //     : [1.4, 2.1, 2.8, 3.4];
    const speed = speedTiers[Math.floor(Math.random() * speedTiers.length)];
    return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2.2 + Math.floor(Math.random() * 3), // 2〜4pxの正方形ドット
        life: isEmber ? 90 + Math.random() * 60 : 55 + Math.random() * 35,
        age: 0,
        trail: [],
        isEmber,
        // 明滅の位相。sin波ではなくON/OFFの矩形波で点滅させる
        blinkOffset: Math.floor(Math.random() * 6),
        // このフレーム数を過ぎたら明滅をやめてなめらかなフェードに切り替える
        blinkUntil: isEmber ? 16 + Math.random() * 10 : Infinity,
    };
}

// 爆発の瞬間に広がるひし形のワイヤーフレーム衝撃波を1個生成する
function spawnShockwaveRing(x, y, color) {
    return { x, y, color, radius: 2, life: 26, age: 0 };
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
    fireworks: {
        label: 'Fireworks（花火）',
        init(width, height) {
            return {
                width,
                height,
                rockets: [],
                particles: [],
                rings: [],
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

            // ロケット（上昇中）の更新・描画。丸ではなく正方形ドットの尾を刻む
            effectData.rockets = effectData.rockets.filter((rocket) => {
                rocket.trail.push({ x: rocket.x, y: rocket.y });
                if (rocket.trail.length > 8) rocket.trail.shift();

                rocket.x += rocket.vx;
                rocket.y += rocket.vy;
                rocket.vy *= 0.99; // わずかに減速

                // 走査線のようなドット状の尾
                rocket.trail.forEach((pt, i) => {
                    const a = (i / rocket.trail.length) * 0.6;
                    ctx.fillStyle = `rgba(${rocket.color}, ${a})`;
                    ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
                });

                // 先端の光（正方形ドット）
                ctx.fillStyle = `rgba(${rocket.color}, 0.95)`;
                ctx.fillRect(rocket.x - 1.5, rocket.y - 1.5, 3, 3);

                // 頂点到達（または勢いが尽きた）ら爆発してロケットは消滅
                if (rocket.y <= rocket.targetY || rocket.vy > -0.5) {
                    // 方向をsectorCount等分にして規則的に割れさせる（密度を上げてボリューム感を出す）
                    const sectorCount = 14 + Math.floor(Math.random() * 8); // 14〜21方向
                    const sectorAngle = (Math.PI * 2) / sectorCount;
                    for (let i = 0; i < sectorCount; i++) {
                        // 1方向あたり3〜4粒。最後の1粒だけ尾を引くエンバーにして余韻を残す
                        const grains = 4 + Math.floor(Math.random() * 2);
                        for (let g = 0; g < grains; g++) {
                            const isEmber = g === grains - 1;
                            effectData.particles.push(
                                spawnFireworkParticle(rocket.x, rocket.y, rocket.color, sectorAngle, i, isEmber)
                            );
                        }
                    }
                    effectData.rings.push(spawnShockwaveRing(rocket.x, rocket.y, rocket.color));
                    return false;
                }
                return true;
            });

            // 衝撃波リング（ひし形のワイヤーフレームが広がって消える）
            effectData.rings = effectData.rings.filter((ring) => {
                ring.age++;
                ring.radius += 2.6;
                const alpha = Math.max(0, 1 - ring.age / ring.life);

                ctx.save();
                ctx.translate(ring.x, ring.y);
                ctx.rotate(Math.PI / 4); // 正方形を45度回してひし形に見せる
                ctx.strokeStyle = `rgba(${ring.color}, ${alpha * 0.8})`;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-ring.radius, -ring.radius, ring.radius * 2, ring.radius * 2);
                ctx.restore();

                return ring.age < ring.life;
            });

            // 爆発パーティクルの更新・描画（正方形ドット＋ON/OFFの矩形波で明滅）
            effectData.particles = effectData.particles.filter((p) => {
                p.age++;
                // エンバー（尾を引くタイプ）は重力を強めにして柳が垂れるように落とす
                const gravity = p.isEmber ? 0.05 : 0.03;
                const drag    = p.isEmber ? 0.992 : 0.98; // 空気抵抗は弱めにして軌跡を長く見せる
                p.vy += gravity;
                p.vx *= drag;
                p.vy *= drag;

                // エンバーは尾を長めに残して余韻を出す
                const trailMax = p.isEmber ? 7 : 3;
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > trailMax) p.trail.shift();

                p.x += p.vx;
                p.y += p.vy;

                const t = p.age / p.life;
                let alpha = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / 0.9);

                if (p.age < p.blinkUntil) {
                    // 発生直後はON/OFFの矩形波で明滅させる（デジタル感）
                    const blink = Math.floor(p.age / 3 + p.blinkOffset) % 2 === 0 ? 1 : 0.25;
                    alpha *= blink;
                } else if (p.isEmber) {
                    // 明滅をやめてなめらかに減光させ、尾を引く余韻に見せる
                    alpha *= 0.88;
                }

                // 尾（小さな正方形を並べる）
                p.trail.forEach((pt, i) => {
                    const a = alpha * (i / p.trail.length) * 0.5;
                    const s = Math.max(1, p.size - 1);
                    ctx.fillStyle = `rgba(${p.color}, ${a})`;
                    ctx.fillRect(pt.x - s / 2, pt.y - s / 2, s, s);
                });

                // 本体（正方形ドット）
                ctx.fillStyle = `rgba(${p.color}, ${alpha})`;
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);

                return p.age < p.life;
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
