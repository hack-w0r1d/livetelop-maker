// premium.jsのみで使用するDOM参照はここでローカルに宣言
const premiumLocked   = document.getElementById('premiumLocked');
const premiumContent  = document.getElementById('premiumContent');
const premiumToast    = document.getElementById('premiumToast');
const premiumOverlay  = document.getElementById('premiumOverlay');
const premiumBadge    = document.querySelector('.badge');
const premiumKeyModal = document.getElementById('premiumKeyModal');
const premiumKeyInput = document.getElementById('premiumKeyInput');
const unlockBtn       = document.getElementById('unlockBtn');

// ─────────────────────────────────────────
// イベントリスナー
// ─────────────────────────────────────────

// モーダル表示
unlockBtn.addEventListener('click', () => {
    premiumKeyModal.classList.remove('hidden');
    premiumKeyInput.value = '';
});

// モーダル非表示
document.getElementById('premiumKeyCancel').addEventListener('click', () => {
    premiumKeyModal.classList.add('hidden');
});

document.getElementById('premiumKeySubmit').addEventListener('click', submitPremiumKey);

premiumKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPremiumKey();
});

// ─────────────────────────────────────────
// プレミアム解放
// ─────────────────────────────────────────

function submitPremiumKey() {
    const key = premiumKeyInput.value.trim();

    if (!key) {
        alert('解放キーを入力してください');
        return;
    }

    if (key === 'Sweet_dreams') {
        localStorage.setItem('premium', 'true');
        premiumKeyModal.classList.add('hidden');
        showPremiumContent();
        showPremiumAnimation();
        setTimeout(() => glowPremiumBadge(), 3600);
    } else {
        alert('解放キーが正しくありません');
    }
}

export function showPremiumContent() {
    premiumLocked.classList.add('hidden');
    premiumContent.classList.remove('hidden');
}

function showPremiumAnimation() {
    premiumOverlay.classList.remove('hidden');
    requestAnimationFrame(() => premiumOverlay.classList.add('show'));

    setTimeout(() => {
        premiumToast.classList.remove('hidden');
        requestAnimationFrame(() => premiumToast.classList.add('show'));
    }, 500);

    setTimeout(() => premiumToast.classList.remove('show'), 2600);
    setTimeout(() => premiumOverlay.classList.remove('show'), 3100);

    setTimeout(() => {
        premiumToast.classList.add('hidden');
        premiumOverlay.classList.add('hidden');
    }, 3600);
}

function glowPremiumBadge() {
    if (!premiumBadge) return;
    premiumBadge.classList.remove('glow');
    void premiumBadge.offsetWidth; // reflow強制でアニメーションをリセット
    premiumBadge.classList.add('glow');
}

// ─────────────────────────────────────────
// 初期化（main.jsのDOMContentLoadedから呼び出す）
// ─────────────────────────────────────────

export function initPremium() {
    if (localStorage.getItem('premium') === 'true') {
        showPremiumContent();
    }
}
