const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const marquee = document.getElementById('marquee');
const startBtn = document.getElementById('startBtn');
const video = document.getElementById('pipVideo');
const pipBtn = document.getElementById('pipBtn');

pipBtn.addEventListener('click', async () => {
    try {
        if (!document.pictureInPictureElement) {
            await video.requestPictureInPicture();
        } else {
            await document.exitPictureInPicture();
        }
    } catch (e) {
        console.error('PiP error', e);
    }
});

startBtn.addEventListener('click', () => {
    const stream = canvas.captureStream(60); // 60fps
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = e => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);

    // videoタグに読み込んで自動ループ再生
    video.src = url;
    video.play();
    };

    recorder.start();

    let x = canvas.width;
    const speed = 2; // 横スクロール速度
    const text = marquee.textContent;
    ctx.font = '48px sans-serif';
    const textWidth = ctx.measureText(text).width;

    function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '48px sans-serif';
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
