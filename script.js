// ================================
// script.js complet Otter Social
// ================================

// ----------------- CONFIG -----------------
const SUPABASE_URL = 'https://xxxjfrnuljhifietuxfv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XqFC1KjP2o3BA3I57CMMSg_oE9Ieug4';
const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let walletPublicKey = null;
let userProfile = null;
let postsCache = [];

// ----------------- UTILS -----------------
function showNotification(msg) {
    const n = document.createElement('div');
    n.textContent = msg;
    n.className = 'notif';
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

// ----------------- WALLET -----------------
document.getElementById('connectBtn').addEventListener('click', async () => {
    if (window.solana) {
        try {
            const resp = await window.solana.connect();
            walletPublicKey = resp.publicKey.toString();
            document.getElementById('wallet-status').textContent = walletPublicKey;
            await loadOrCreateProfile(walletPublicKey);
        } catch (err) {
            console.error(err);
        }
    } else {
        alert('Please install Phantom wallet!');
    }
});

// ----------------- PROFILE -----------------
async function loadOrCreateProfile(wallet) {
    const { data } = await supabase.from('profiles').select('*').eq('wallet', wallet).single();
    if (!data) {
        await supabase.from('profiles').insert({ wallet, points: 0, level: 1, bio: '', avatar_url: '' });
        userProfile = { wallet, points: 0, level: 1, bio: '', avatar_url: '' };
    } else {
        userProfile = data;
    }
    renderProfile();
}

function renderProfile() {
    document.getElementById('bioInput').value = userProfile.bio || '';
    document.getElementById('avatarPreview').src = userProfile.avatar_url || '/img/default-avatar.png';
    renderLevelBadge();
    renderPortfolioChart();
}

function renderLevelBadge() {
    const badge = document.getElementById('profileLevelBadge');
    badge.textContent = `Lv ${userProfile.level}`;
}

async function saveProfile() {
    userProfile.bio = document.getElementById('bioInput').value;
    await supabase.from('profiles').update({ bio: userProfile.bio }).eq('wallet', walletPublicKey);
    showNotification('Profile saved!');
    renderProfile();
}

// ----------------- POSTS -----------------
document.getElementById('postBtn').addEventListener('click', async () => {
    const text = document.getElementById('postText').value.trim();
    if (!text) return;
    const { data } = await supabase.from('posts').insert([{ wallet: walletPublicKey, content: text, points: 0 }]);
    postsCache.unshift(data[0]);
    document.getElementById('postText').value = '';
    await addPoints(5); // points pour poster
    renderFeed();
});

async function addPoints(amount) {
    userProfile.points += amount;
    const newLevel = Math.floor(userProfile.points / 50) + 1;
    if (newLevel > userProfile.level) {
        userProfile.level = newLevel;
        showNotification(`Level Up! Lv ${newLevel}`);
    }
    await supabase.from('profiles').update({ points: userProfile.points, level: userProfile.level }).eq('wallet', walletPublicKey);
    renderLevelBadge();
}

async function renderFeed() {
    const feedEl = document.getElementById('feed');
    feedEl.innerHTML = '';
    postsCache.forEach(post => {
        const div = document.createElement('div');
        div.className = 'post-card';
        div.innerHTML = `<p>${post.content}</p>
                         <div class='post-actions'>
                         <button onclick='votePost(${post.id},1)'>👍</button>
                         <button onclick='votePost(${post.id},-1)'>👎</button>
                         <span>${post.points}</span>
                         <button onclick='openReplyModal(${post.id})'>Reply</button>
                         </div>`;
        feedEl.appendChild(div);
    });
}

async function votePost(postId, value) {
    const post = postsCache.find(p => p.id === postId);
    post.points += value;
    await supabase.from('posts').update({ points: post.points }).eq('id', postId);
    await addPoints(1); // points pour voter
    renderFeed();
}

// ----------------- REPLIES -----------------
function openReplyModal(postId) {
    const modal = document.getElementById('replyModal');
    modal.classList.remove('hidden');
    document.getElementById('sendReply').onclick = async () => {
        const text = document.getElementById('replyText').value.trim();
        if (!text) return;
        await supabase.from('replies').insert([{ post_id: postId, wallet: walletPublicKey, content: text }]);
        await addPoints(2);
        modal.classList.add('hidden');
        document.getElementById('replyText').value = '';
        showNotification('Reply posted!');
    };
}

// ----------------- HASHTAGS & TRENDING -----------------
async function updateTrending() {
    const { data } = await supabase.from('posts').select('*');
    const hashtags = {};
    data.forEach(p => {
        const matches = p.content.match(/#\w+/g);
        if (matches) matches.forEach(h => hashtags[h] = (hashtags[h]||0)+1);
    });
    const sorted = Object.entries(hashtags).sort((a,b)=>b[1]-a[1]);
    const list = document.getElementById('trending-list');
    list.innerHTML = '';
    sorted.slice(0,10).forEach(h => {
        const li = document.createElement('li');
        li.textContent = `${h[0]} (${h[1]})`;
        list.appendChild(li);
    });
}
setInterval(updateTrending, 5000);

// ----------------- PORTFOLIO CHART -----------------
function renderPortfolioChart() {
    const ctx = document.getElementById('portfolioChart');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Solana', 'ETH', 'BTC'],
            datasets: [{ data: [40, 30, 30], backgroundColor: ['#00FFA3','#DC1FFF','#FF5733']]}
        }
    });
}

// ----------------- INIT -----------------
(async () => {
    const { data } = await supabase.from('posts').select('*').order('created_at',{ascending:false});
    postsCache = data;
    renderFeed();
    updateTrending();
})();
