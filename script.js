const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const startBtn = document.getElementById('createTelopBtn');
const video = document.getElementById('pipVideo');
const pipBtn = document.getElementById('pipBtn');
const preview = document.getElementById("telopPreview");
let telopText = "ここにお知らせや注意事項を書いてテロップとして流すことができます。";

pipBtn.addEventListener('click', async () => {
    try {
        if (!document.pictureInPictureElement) {
            await video.requestPictureInPicture();
            pipBtn.textContent = "テロップ使用解除";
        } else {
            await document.exitPictureInPicture();
            pipBtn.textContent = "テロップ使用";
        }
    } catch (e) {
        console.error('PiP error', e);
    }
});

document.getElementById("updateTelopBtn").addEventListener('click', () => {
    const text = document.getElementById("telopInput").value;
    if (!text) return;

    telopText = text;
    preview.textContent = text;
});

startBtn.addEventListener('click', () => {
    const stream = canvas.captureStream(60); // 60fps
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = e => {
    const blob = new Blob(chunks, { type: 'video/webm' });

    // videoタグに読み込んで自動ループ再生
    if (video.src) URL.revokeObjectURL(video.src);
    video.src = URL.createObjectURL(blob);
    video.play();
    };

    recorder.start();

    let x = canvas.width;
    const speed = 2; // 横スクロール速度
    const text = telopText;
    ctx.font = '48px sans-serif';
    const textWidth = ctx.measureText(telopText).width;

    function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
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
