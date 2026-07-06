import {
    state,
    canvas, ctx,
    video,
    preview,
    bgColor, textColor,
    speedFromSlider,
    createTelopBtn, pipBtn,
    isAndroid,
} from './state.js';
import {
    saveCurrentTelopState,
    showNotice,
} from './storage.js';

// ─────────────────────────────────────────
// 初期化
// ─────────────────────────────────────────
export function initTelop() {
    video.controls = isAndroid;

    // Lottieアニメーション初期化
    lottieAnim = lottie.loadAnimation({
        container: catAnimEl,
        renderer:  'svg',
        loop:      true,
        autoplay:  false,
        path:      'animations/cat.json',
    });
}

// ─────────────────────────────────────────
// Canvas描画スタイル設定
// ─────────────────────────────────────────
function setTextStyle(ctx, option) {
    if (!option || option.gradientType === 'none') {
        ctx.fillStyle = option?.textColor || '#ffffff';
        return;
    }

    const fontSize  = parseInt(ctx.font, 10) || 48;
    const textWidth = ctx.measureText(option.text).width;
    let gradient;

    if (option.gradientType === 'horizontal') {
        gradient = ctx.createLinearGradient(
            option.x, option.y,
            option.x + textWidth, option.y
        );
    } else if (option.gradientType === 'vertical') {
        gradient = ctx.createLinearGradient(
            option.x, option.y - fontSize,
            option.x, option.y
        );
    }

    gradient.addColorStop(0, option.color1);
    gradient.addColorStop(1, option.color2);
    ctx.fillStyle = gradient;
}

// ─────────────────────────────────────────
// テロップ作成中の状態管理（中断処理用）
// ─────────────────────────────────────────
let isCreating          = false;
let isCancelling        = false;
let activeRecorder      = null;
let rafId               = null;  // requestAnimationFrameのID
let countdownIntervalId = null;

// DOM参照をモジュールスコープに移動
const creatingNotice    = document.getElementById('creatingNotice');
const creatingText      = document.getElementById('creatingText');
const catAnimEl         = document.getElementById('catAnim');
const cancelCreatingBtn = document.getElementById('cancelCreatingBtn');

// ─────────────────────────────────────────
// テロップ作成（Canvas録画）
// ─────────────────────────────────────────
createTelopBtn.addEventListener('click', async () => {
    if (isCreating) return;  // 二重起動防止

    // PiP中なら先に解除してからテロップを作成（iOSの文字サイズバグ対策）
    if (document.pictureInPictureElement) {
        try {
            await document.exitPictureInPicture();
            pipBtn.textContent = 'テロップ使用';
            pipBtn.classList.remove('active');
        } catch (e) {
            console.error('PiP exit error', e);
        }
    }

    createTelopBtn.style.display = 'none';

    // フォント読み込み完了を待機
    await document.fonts.ready;

    const font = `48px "${state.fontFamily}", sans-serif`;
    ctx.font = font;

    const text = preview.textContent;

    // 概算時間を計算
    const speed    = speedFromSlider(state.speedLevel); // スライダー位置から実速度を取得
    const fps      = 60;
    const distance = canvas.width + ctx.measureText(text).width;
    const durationSec = Math.ceil((distance / speed) / fps);

    isCreating = true;
    isCancelling = false;

    creatingNotice.classList.remove('hidden');
    catAnimEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    buildCreatingText(durationSec);
    lottieAnim.play();

    // カウントダウン
    let remaining = durationSec;
    countdownIntervalId = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            const countdownEl = document.getElementById('creatingCountdown');
            if (countdownEl) countdownEl.textContent = ` 約${remaining}秒`;
        } else {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
            finishCreatingUI();

            // PiP化されていない時だけテロップ使用ボタンへ自動スクロール
            if (!document.pictureInPictureElement) {
                pipBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, 1000);

    const stream   = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks   = [];
    activeRecorder = recorder;

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
        activeRecorder = null;

        // 中断時は動画を生成せず破棄する
        if (isCancelling) {
            isCancelling = false;
            return;
        }

        const blob = new Blob(chunks, { type: 'video/webm' });
        if (video.src) URL.revokeObjectURL(video.src);
        video.src = URL.createObjectURL(blob);
        video.play();
    };

    saveCurrentTelopState();
    recorder.start();

    let x = canvas.width;
    const textWidth = ctx.measureText(text).width;

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = bgColor.value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setTextStyle(ctx, {
            gradientType: state.gradientType,
            text,
            x,
            y: 70,
            color1:    state.gradientColor1,
            color2:    state.gradientColor2,
            textColor: textColor.value,
        });
        ctx.fillText(text, x, 70);
        x -= speed;
    }

    function loop() {
        draw();
        if (x < -textWidth) {
            recorder.stop();
            rafId = null;
            return;
        }
        rafId = requestAnimationFrame(loop);
    }
    loop();
});

// 作成中UIを終了状態に戻す（正常完了・中断の両方から呼ぶ）
function finishCreatingUI() {
    isCreating = false;
    creatingNotice.classList.add('hidden');
    lottieAnim.stop();
    createTelopBtn.style.display = 'block';
 }

let lottieAnim = null;

// ─────────────────────────────────────────
// テロップ作成の中断
// ─────────────────────────────────────────
cancelCreatingBtn.addEventListener('click', () => {
    if (!isCreating) return;
    isCancelling = true;

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (countdownIntervalId !== null) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }
    if (activeRecorder && activeRecorder.state !== 'inactive') {
        activeRecorder.stop(); // onstop側でisCancellingを見て動画生成をスキップする
    }

    finishCreatingUI();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotice('テロップの作成を中断しました', { type: 'red' });
});

function buildCreatingText(sec) {
    const T       = 2.5;
    const bounceD = 0.35;
    const lGap    = 0.1;
    const dGap    = 0.22;
    const letters = 'Creating'.split('');
    const nL      = letters.length; // 8

    const dotStart       = (nL - 1) * lGap + bounceD + 0.05; // 1.0s
    const lastDotEnd     = dotStart + 2 * dGap + bounceD;     // 1.69s
    const disappearStart = lastDotEnd + 0.15;                  // 1.84s
    const disappearEnd   = disappearStart + 0.2;               // 2.04s

    // <style>を1つだけ管理（重複挿入しない）
    let styleEl = document.getElementById('creatingAnimStyle');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'creatingAnimStyle';
        document.head.appendChild(styleEl);
    }

    const pct = t => (t / T * 100).toFixed(2);
    let css = '';

    // 文字バウンスキーフレーム（8個）
    letters.forEach((_, i) => {
        const s    = i * lGap;
        const peak = s + bounceD * 0.45;
        const e    = s + bounceD;
        css += `@keyframes cl${i}{`
             + `0%,${pct(s)}%{transform:translateY(0)}`
             + `${pct(peak)}%{transform:translateY(-7px)}`
             + `${pct(e)}%,100%{transform:translateY(0)}}`;
    });

    // ドット出現
    for (let j = 0; j < 3; j++) {
        const s      = dotStart + j * dGap;
        const peak   = s + bounceD * 0.45;
        const e      = s + bounceD;
        const before = Math.max(0, s - 0.01);
        css += `@keyframes cd${j}{`
             + `0%,${pct(before)}%{opacity:0}`
             + `${pct(s)}%,${pct(disappearStart)}%{opacity:1}`
             + `${pct(disappearEnd)}%,100%{opacity:0}}`;
    }

    styleEl.textContent = css;

    // HTML生成
    const lHTML = letters.map((ch, i) =>
        `<span style="display:inline-block;animation:cl${i} ${T}s ease-in-out infinite">${ch}</span>`
    ).join('');

    const dHTML = [0, 1, 2].map(j =>
        `<span style="display:inline-block;opacity:0;animation:cd${j} ${T}s ease-in-out infinite">.</span>`
    ).join('');

    creatingText.innerHTML =
        `<span>${lHTML} ${dHTML}</span>` +
        `<span id="creatingCountdown"> 約${sec}秒</span>`;
}

// ─────────────────────────────────────────
// Picture-in-Picture制御
// ─────────────────────────────────────────
pipBtn.addEventListener('click', async () => {
    try {
        if (!document.pictureInPictureElement) {
            await video.requestPictureInPicture();
            pipBtn.textContent = 'テロップ使用解除';
            pipBtn.classList.add('active');
        } else {
            await document.exitPictureInPicture();
            pipBtn.textContent = 'テロップ使用';
            pipBtn.classList.remove('active');
        }
    } catch (e) {
        console.error('PiP error', e);
    }
});

video.addEventListener('leavepictureinpicture', () => {
    pipBtn.textContent = 'テロップ使用';
    pipBtn.classList.remove('active');
});
