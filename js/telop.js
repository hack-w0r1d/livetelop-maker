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
import { saveCurrentTelopState } from './storage.js';

// ─────────────────────────────────────────
// 初期化
// ─────────────────────────────────────────
export function initTelop() {
    video.controls = isAndroid;
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
// テロップ作成（Canvas録画）
// ─────────────────────────────────────────
createTelopBtn.addEventListener('click', async () => {
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

    const creatingNotice = document.getElementById('creatingNotice');
    const creatingText   = document.getElementById('creatingText');
    const catAnim        = document.getElementById('catAnim');

    creatingNotice.style.display = 'flex';
    catAnim.style.display        = 'block';
    creatingText.textContent     = `Creating ... 約${durationSec}秒`;

    // カウントダウン
    let remaining = durationSec;
    const countdown = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            creatingText.textContent = `Creating ... 約${remaining}秒`;
        } else {
            clearInterval(countdown);
            creatingNotice.style.display = 'none';
            catAnim.style.display        = 'none';
            createTelopBtn.style.display = 'block';

            // PiP化されていない時だけテロップ使用ボタンへ自動スクロール
            if (!document.pictureInPictureElement) {
                pipBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, 1000);

    const stream   = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks   = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
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
            return;
        }
        requestAnimationFrame(loop);
    }
    loop();
});

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
