/* ================================================================
   PULSE — app.js
   Full logic: Supabase auth, routing, posts, stories, chat
   ================================================================ */

// ---------------------------------------------------------------
// 1. SUPABASE CONFIGURATION
// ---------------------------------------------------------------
const SUPABASE_URL      = 'https://lukbyowagziiyvfmdtlm.supabase.co';      
const SUPABASE_ANON_KEY = 'sb_publishable_1DDELP4WU_UagI-qQ2Zjmg_gr_V9sQ9';  
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------
// 2. DOM ELEMENT REFERENCES
// ---------------------------------------------------------------
const loginSection    = document.getElementById('login-section');
const usernameSection = document.getElementById('username-section');
const appSection      = document.getElementById('app-section');

// ── Auth ──
const otpStep1 = document.getElementById('otp-step-1');
const otpStep2 = document.getElementById('otp-step-2');
const emailInput = document.getElementById('email-input');
const sendOtpBtn = document.getElementById('send-otp-btn');
const otpInput = document.getElementById('otp-input');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const backToEmailBtn = document.getElementById('back-to-email-btn');
const otpEmailDisplay = document.getElementById('otp-email-display');
const googleLoginBtn = document.getElementById('google-login-btn');
const discordLoginBtn = document.getElementById('discord-login-btn');
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const logoutBtn = document.getElementById('logout-btn');
const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

// ── Routing ──
const menuItems = document.querySelectorAll('.menu-item[data-target]');
const appViews = document.querySelectorAll('.app-view');
const mobileComposeBtn = document.getElementById('mobile-compose-btn');

// ── Shared Nav Elements ──
const navUsernameDisplay = document.getElementById('nav-username-display');
const navAvatar = document.getElementById('nav-avatar');

// ── Stories ──
const addStoryBtn = document.getElementById('add-story-btn');
const storyFileInput = document.getElementById('story-file-input');
const storiesFeed = document.getElementById('stories-feed');

// ── Posts Composer ──
const composerAvatar = document.getElementById('composer-avatar');
const postInput = document.getElementById('post-input');
const postBtn = document.getElementById('post-btn');
const charRemaining = document.getElementById('char-remaining');
const feedContainer = document.getElementById('feed-container');
const feedLoading = document.getElementById('feed-loading');

const postAddMediaBtn = document.getElementById('post-add-media-btn');
const postFileInput = document.getElementById('post-file-input');
const postMediaPreview = document.getElementById('post-media-preview');

// ── Explore View ──
const exploreSearchInput = document.getElementById('explore-search-input');
const exploreResults = document.getElementById('explore-results');

// ── Profile View ──
const profileBackBtn = document.getElementById('profile-back-btn');
const profileViewTitle = document.getElementById('profile-view-title');
const profileAvatar = document.getElementById('profile-avatar');
const profileUsernameDisplay = document.getElementById('profile-username-display');
const profileFollowersCount = document.getElementById('profile-followers-count');
const profileFollowingCount = document.getElementById('profile-following-count');
const profileActionContainer = document.getElementById('profile-action-container');
const profilePostsContainer = document.getElementById('profile-posts-container');

// ── Chat View ──
const chatSidebar = document.getElementById('chat-sidebar');
const chatList = document.getElementById('chat-list');
const chatActive = document.getElementById('chat-active');
const chatActiveHeader = document.getElementById('chat-active-header');
const activeChatAvatar = document.getElementById('active-chat-avatar');
const activeChatUsername = document.getElementById('active-chat-username');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatPlaceholder = document.getElementById('chat-placeholder');
const chatInputArea = document.getElementById('chat-input-area');
const chatBackBtn = document.getElementById('chat-back-btn');

const chatMediaPreview = document.getElementById('chat-media-preview');
const chatAddMediaBtn = document.getElementById('chat-add-media-btn');
const chatFileInput = document.getElementById('chat-file-input');
const chatRecordBtn = document.getElementById('chat-record-btn');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');


// ---------------------------------------------------------------
// 3. APPLICATION STATE
// ---------------------------------------------------------------
let currentUser    = null;  
let currentProfile = null;  
let activeViewId   = 'home-view';
let activeChatUserId = null;
let realtimeChannel = null;

// Media States
let postMediaFile = null;
let chatMediaFile = null;

// Audio Recording States
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ---------------------------------------------------------------
// 4. UTILITY HELPERS
// ---------------------------------------------------------------
function setLoading(btn, loading) {
  if (loading) { btn.classList.add('is-loading'); btn.disabled = true; } 
  else { btn.classList.remove('is-loading'); btn.disabled = false; }
}

function showSection(section) {
  loginSection.hidden    = section !== 'login';
  usernameSection.hidden = section !== 'username';
  appSection.hidden      = section !== 'app';
}

function switchView(viewId) {
  activeViewId = viewId;
  appViews.forEach(view => {
    if (view.id === viewId) view.classList.add('active');
    else view.classList.remove('active');
  });

  menuItems.forEach(item => {
    if (item.dataset.target === viewId && !item.classList.contains('fab')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  if (viewId === 'chat-view') {
    chatLayoutUpdateMobile();
  }
}

function chatLayoutUpdateMobile() {
  if (window.innerWidth < 768) {
    if (activeChatUserId) {
      document.querySelector('.chat-layout').classList.add('chat-active-open');
    } else {
      document.querySelector('.chat-layout').classList.remove('chat-active-open');
    }
  }
}

function formatDate(isoString) {
  const date = new Date(isoString); const now = new Date();
  const diffMs = now - date; const diffS = Math.floor(diffMs/1000); const diffM = Math.floor(diffS/60);
  const diffH = Math.floor(diffM/60); const diffD = Math.floor(diffH/24);
  if (diffS < 60) return 'just now';
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7)  return `${diffD}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(username) {
  if (!username) return '?';
  const parts = username.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

async function uploadFile(file, bucketPath) {
  const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;
  const { data, error } = await supabaseClient.storage.from(bucketPath).upload(filePath, file);
  if (error) throw error;
  const { data: { publicUrl } } = supabaseClient.storage.from(bucketPath).getPublicUrl(filePath);
  return publicUrl;
}

// ---------------------------------------------------------------
// 5. AUTHENTICATION & INITIALIZATION
// ---------------------------------------------------------------
async function sendOtp() {
  const email = emailInput.value.trim();
  if (!email) return alert('Enter a valid email.');
  setLoading(sendOtpBtn, true);
  try {
    const { error } = await supabaseClient.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
    otpEmailDisplay.textContent = email;
    otpStep1.hidden = true; otpStep2.hidden = false;
  } catch (err) { alert('Could not send code: ' + err.message); } 
  finally { setLoading(sendOtpBtn, false); }
}

async function verifyOtp() {
  const email = emailInput.value.trim(); const token = otpInput.value.trim();
  if (!token || token.length < 6) return alert('Enter the 6-digit code.');
  setLoading(verifyOtpBtn, true);
  try {
    const { error } = await supabaseClient.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
  } catch (err) { alert('Verification failed: ' + err.message); } 
  finally { setLoading(verifyOtpBtn, false); }
}

async function signInWithOAuth(provider) {
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.href } });
    if (error) throw error;
  } catch (err) { alert(`${provider} login failed: ` + err.message); }
}

async function logout() {
  try {
    await supabaseClient.auth.signOut();
    currentUser = null; currentProfile = null;
    showSection('login');
    otpStep1.hidden = false; otpStep2.hidden = true;
    otpInput.value = ''; emailInput.value = '';
    if (realtimeChannel) { supabaseClient.removeChannel(realtimeChannel); }
  } catch (err) { alert('Logout error: ' + err.message); }
}

async function fetchProfile(userId) {
  const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
  return data || null;
}

async function saveProfile(username) {
  if (!currentUser) return;
  username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!username || username.length < 3) return alert('Username must be 3+ chars (letters, numbers, underscores).');
  
  setLoading(saveUsernameBtn, true);
  try {
    const { error } = await supabaseClient.from('profiles').upsert({
      id: currentUser.id, username, avatar_url: currentUser.user_metadata?.avatar_url || null, updated_at: new Date().toISOString()
    });
    if (error) throw error;
    currentProfile = await fetchProfile(currentUser.id);
    initAppUI(); showSection('app');
  } catch (err) { alert('Save username error: ' + err.message); } 
  finally { setLoading(saveUsernameBtn, false); }
}

function initAppUI() {
  if (!currentProfile) return;
  const username = currentProfile.username;
  navUsernameDisplay.textContent = `@${username}`;
  navAvatar.textContent = getInitials(username);
  composerAvatar.textContent = getInitials(username);
  
  switchView('home-view');
  fetchAndRenderPosts();
  fetchStories();
  loadChatSidebar();
  subscribeToChatUpdates();
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    currentProfile = await fetchProfile(currentUser.id);
    if (!currentProfile) showSection('username');
    else { initAppUI(); showSection('app'); }
  } else {
    currentUser = null; currentProfile = null; showSection('login');
  }
});

(async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) showSection('login');
})();


// ---------------------------------------------------------------
// 6. STORIES FEATURE
// ---------------------------------------------------------------
addStoryBtn.addEventListener('click', () => storyFileInput.click());

storyFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  storyFileInput.value = '';
  
  // Create temp UI
  const tempDiv = document.createElement('div');
  tempDiv.className = 'story-item';
  tempDiv.innerHTML = `<div class="story-ring"><div class="story-avatar"><div class="spinner" style="width:20px;height:20px;border-width:2px;margin:auto;"></div></div></div><span class="story-label">Uploading...</span>`;
  storiesFeed.prepend(tempDiv);

  try {
    const fileUrl = await uploadFile(file, 'app-media');
    const type = file.type.startsWith('video') ? 'video' : 'image';
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseClient.from('stories').insert({
      user_id: currentUser.id, media_url: fileUrl, media_type: type, expires_at: expiresAt
    });
    if (error) throw error;
    fetchStories(); // refresh
  } catch (err) {
    alert('Story upload failed: ' + err.message);
    tempDiv.remove();
  }
});

async function fetchStories() {
  try {
    const { data: stories, error } = await supabaseClient.from('stories')
      .select('id, media_url, media_type, user_id, profiles(username)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Deduplicate stories by user for the rings (Instagram-like). For simplicity, just show distinct recent stories.
    storiesFeed.innerHTML = '';
    if (!stories || stories.length === 0) {
       // Optional: "No stories" msg
       return;
    }

    stories.forEach(story => {
      const username = story.user_id === currentUser.id ? 'You' : story.profiles?.username || 'User';
      const div = document.createElement('div');
      div.className = 'story-item';
      
      let mediaPreview = '';
      if (story.media_type === 'image') {
        mediaPreview = `<img src="${story.media_url}" class="story-img">`;
      } else {
        mediaPreview = `<video src="${story.media_url}" class="story-img" autoplay muted loop playsinline></video>`;
      }

      div.innerHTML = `
        <div class="story-ring">
          <div class="story-avatar">
            ${mediaPreview}
          </div>
        </div>
        <span class="story-label">${username}</span>
      `;
      // Clicking a story could open a full-screen viewer, leaving empty for now.
      div.addEventListener('click', () => { window.open(story.media_url, '_blank')});
      storiesFeed.appendChild(div);
    });

  } catch(err) { console.error('Error fetching stories:', err); }
}


// ---------------------------------------------------------------
// 7. POSTS & MEDIA COMPOSER
// ---------------------------------------------------------------
postAddMediaBtn.addEventListener('click', () => postFileInput.click());

postFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  postMediaFile = file;
  postMediaPreview.hidden = false;
  
  const objectUrl = URL.createObjectURL(file);
  if (file.type.startsWith('image')) {
    postMediaPreview.innerHTML = `<img src="${objectUrl}"><button class="remove-media-btn" onclick="clearPostMedia(event)">&times;</button>`;
  } else if (file.type.startsWith('video')) {
    postMediaPreview.innerHTML = `<video src="${objectUrl}" controls></video><button class="remove-media-btn" onclick="clearPostMedia(event)">&times;</button>`;
  }
});

window.clearPostMedia = function(e) {
  if (e) e.preventDefault();
  postMediaFile = null;
  postFileInput.value = '';
  postMediaPreview.hidden = true;
  postMediaPreview.innerHTML = '';
}

async function createPost() {
  const content = postInput.value.trim();
  if (!content && !postMediaFile) return alert('Post cannot be empty.');
  if (content.length > 500) return alert('Post exceeds 500 chars.');
  setLoading(postBtn, true);

  try {
    let fileUrl = null;
    let fileType = null;

    if (postMediaFile) {
      fileUrl = await uploadFile(postMediaFile, 'app-media');
      fileType = postMediaFile.type.startsWith('video') ? 'video' : 'image';
    }

    const { error } = await supabaseClient.from('posts').insert({
      user_id: currentUser.id, content, media_url: fileUrl, media_type: fileType, created_at: new Date().toISOString()
    });
    if (error) throw error;

    postInput.value = ''; clearPostMedia();
    charRemaining.textContent = '500';
    await fetchAndRenderPosts();
  } catch (err) { alert('Could not create post: ' + err.message); } 
  finally { setLoading(postBtn, false); }
}

async function fetchAndRenderPosts(containerElement = feedContainer, userIdFilter = null) {
  // Clear non-loading elems
  Array.from(containerElement.children).forEach(c => {
    if (!c.classList.contains('feed-loading')) c.remove();
  });
  
  const loader = containerElement.querySelector('.feed-loading');
  if (loader) loader.hidden = false;

  try {
    let query = supabaseClient.from('posts')
      .select(`id, content, media_url, media_type, created_at, user_id, profiles ( username )`)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (userIdFilter) query = query.eq('user_id', userIdFilter);

    const { data: posts, error } = await query;
    if (error) throw error;

    if (loader) loader.hidden = true;

    if (!posts || posts.length === 0) {
      const emptyEl = document.createElement('div'); emptyEl.className = 'feed-empty';
      emptyEl.innerHTML = `<span>No posts found.</span>`;
      containerElement.appendChild(emptyEl);
      return;
    }

    posts.forEach(post => {
      const username = post.profiles?.username || 'Anonymous';
      const isOwn = post.user_id === currentUser?.id;
      
      let mediaHtml = '';
      if (post.media_url) {
        if (post.media_type === 'video') mediaHtml = `<div class="post-media"><video src="${post.media_url}" controls></video></div>`;
        else mediaHtml = `<div class="post-media"><img src="${post.media_url}"></div>`;
      }

      const card = document.createElement('article');
      card.className = 'post-card'; card.dataset.id = post.id;
      card.innerHTML = `
        <div class="post-header" onclick="loadProfileView('${post.user_id}')">
          <div class="avatar-circle" aria-hidden="true">${getInitials(username)}</div>
          <div class="post-meta"><div class="post-username">@${username}</div><div class="post-time">${formatDate(post.created_at)}</div></div>
        </div>
        <p class="post-content">${escapeHtml(post.content)}</p>
        ${mediaHtml}
        <div class="post-actions">
          <button class="post-action-btn like-btn">❤️ Like</button>
          ${isOwn ? `<button class="post-action-btn delete-btn" onclick="deletePost('${post.id}')">🗑️ Delete</button>` : ''}
        </div>
      `;
      containerElement.appendChild(card);
    });

  } catch (err) {
    if (loader) loader.hidden = true;
    alert('Error loading posts: ' + err.message);
  }
}

window.deletePost = async function(postId) {
  if (!confirm('Delete post?')) return;
  try {
    const { error } = await supabaseClient.from('posts').delete().eq('id', postId).eq('user_id', currentUser.id);
    if (error) throw error;
    document.querySelectorAll(`[data-id="${postId}"]`).forEach(c => c.remove());
  } catch(err) { alert('Delete failed: ' + err.message); }
}


// ---------------------------------------------------------------
// 8. EXPLORE & PROFILE (FOLLOWS)
// ---------------------------------------------------------------
let searchTimeout;
exploreSearchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (!q) { exploreResults.innerHTML = '<div class="feed-empty">Enter a username to search.</div>'; return; }
  
  searchTimeout = setTimeout(async () => {
    try {
      const { data: users, error } = await supabaseClient.from('profiles').select('id, username').ilike('username', `%${q}%`).neq('id', currentUser.id).limit(10);
      if (error) throw error;
      exploreResults.innerHTML = '';
      if (users.length === 0) { exploreResults.innerHTML = '<div class="feed-empty">No users found.</div>'; return; }
      
      users.forEach(u => {
        const row = document.createElement('div'); row.className = 'user-row';
        row.innerHTML = `<div class="avatar-circle">${getInitials(u.username)}</div><div class="user-row-info"><div class="user-row-name">@${u.username}</div></div>`;
        row.onclick = () => loadProfileView(u.id);
        exploreResults.appendChild(row);
      });
    } catch (err) { console.error('Search error', err); }
  }, 400);
});

window.loadProfileView = async function(userId) {
  switchView('profile-view');
  profileBackBtn.hidden = false;
  profileUsernameDisplay.textContent = 'Loading...';
  profilePostsContainer.innerHTML = '';
  profileActionContainer.innerHTML = '';
  
  try {
    const [profileData, postsRes, followersRes, followingRes, isFollowingRes] = await Promise.all([
      fetchProfile(userId),
      fetchAndRenderPosts(profilePostsContainer, userId),
      supabaseClient.from('follows').select('id', { count: 'exact' }).eq('following_id', userId),
      supabaseClient.from('follows').select('id', { count: 'exact' }).eq('follower_id', userId),
      supabaseClient.from('follows').select('id').eq('follower_id', currentUser.id).eq('following_id', userId).single()
    ]);

    if (!profileData) { profileUsernameDisplay.textContent = 'User not found'; return; }

    profileUsernameDisplay.textContent = `@${profileData.username}`;
    profileAvatar.textContent = getInitials(profileData.username);
    profileFollowersCount.textContent = followersRes.count || 0;
    profileFollowingCount.textContent = followingRes.count || 0;

    const isOwnProfile = userId === currentUser.id;
    const isFollowing = !!isFollowingRes.data;

    if (isOwnProfile) {
      profileActionContainer.innerHTML = `<button class="btn btn-outline btn-sm" disabled>Edit Profile</button>`;
    } else {
      profileActionContainer.innerHTML = `
        <button class="btn ${isFollowing ? 'btn-outline' : 'btn-primary'} btn-sm" id="btn-toggle-follow">
          ${isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      `;
      document.getElementById('btn-toggle-follow').onclick = () => toggleFollow(userId, !isFollowing);
    }

  } catch (err) {
    if (err.code !== 'PGRST116') console.error('Error loading profile', err); 
  }
}

async function toggleFollow(targetId, shouldFollow) {
  try {
    if (shouldFollow) {
      await supabaseClient.from('follows').insert({ follower_id: currentUser.id, following_id: targetId });
    } else {
      await supabaseClient.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetId);
    }
    // Reload profile actions
    loadProfileView(targetId);
    // Reload chat sidebar
    loadChatSidebar();
  } catch (err) { alert('Follow action failed: ' + err.message); }
}


// ---------------------------------------------------------------
// 9. CHAT SYSTEM
// ---------------------------------------------------------------
async function loadChatSidebar() {
  try {
    // A simplistic approach: Get users you follow to show in the chat sidebar
    const { data: follows, error } = await supabaseClient.from('follows').select('following_id, profiles!follows_following_id_fkey(username)').eq('follower_id', currentUser.id);
    if (error) throw error;
    
    chatList.innerHTML = '';
    if (!follows || follows.length === 0) {
      chatList.innerHTML = '<div class="feed-empty">Follow users from Explore to start chatting.</div>'; return;
    }

    follows.forEach(f => {
      const u = f.profiles;
      const row = document.createElement('div');
      row.className = `chat-user-row ${f.following_id === activeChatUserId ? 'active' : ''}`;
      row.onclick = () => openChatUser(f.following_id, u.username);
      row.innerHTML = `
        <div class="avatar-circle" style="width:36px;height:36px;font-size:0.8rem;">${getInitials(u.username)}</div>
        <div class="chat-user-info"><div class="chat-user-name">@${u.username}</div></div>
      `;
      chatList.appendChild(row);
    });

  } catch(err) { console.error('Load chat sidebar err', err); }
}

window.openChatUser = async function(userId, username) {
  activeChatUserId = userId;
  switchView('chat-view'); // ensure we are in chat layout
  chatLayoutUpdateMobile();

  // Highlight sidebar
  document.querySelectorAll('.chat-user-row').forEach(row => row.classList.remove('active'));
  // UI tweaks
  chatPlaceholder.hidden = true;
  chatActiveHeader.hidden = false;
  chatInputArea.hidden = false;
  activeChatUsername.textContent = `@${username}`;
  activeChatAvatar.textContent = getInitials(username);
  
  await fetchChatHistory();
}

async function fetchChatHistory() {
  chatMessagesContainer.innerHTML = '';
  try {
    const { data: msgs, error } = await supabaseClient.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${activeChatUserId}),and(sender_id.eq.${activeChatUserId},receiver_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true }); // older to newer
      
    if (error) throw error;
    
    msgs.forEach(m => appendMessageToDOM(m));
    scrollChatBottom();
  } catch(err) { console.error('Fetch chat err:', err); }
}

function appendMessageToDOM(msg) {
  const isSent = msg.sender_id === currentUser.id;
  const div = document.createElement('div');
  div.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
  
  let mediaHtml = '';
  if (msg.media_url) {
    if (msg.media_type === 'image') mediaHtml = `<img src="${msg.media_url}" class="message-media">`;
    else if (msg.media_type === 'video') mediaHtml = `<video src="${msg.media_url}" class="message-media" controls></video>`;
    else if (msg.media_type === 'audio') mediaHtml = `<audio src="${msg.media_url}" class="message-media message-voice" controls></audio>`;
  }

  div.innerHTML = `
    ${mediaHtml}
    ${msg.content ? `<div>${escapeHtml(msg.content)}</div>` : ''}
    <span class="message-time">${formatDate(msg.created_at)}</span>
  `;
  chatMessagesContainer.appendChild(div);
}

function scrollChatBottom() {
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function subscribeToChatUpdates() {
  realtimeChannel = supabaseClient.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const m = payload.new;
      if (
        (m.sender_id === activeChatUserId && m.receiver_id === currentUser.id) ||
        (m.sender_id === currentUser.id && m.receiver_id === activeChatUserId)
      ) {
        // Prevent duplicate rendering locally if we already appended it immediately on send
        // Simple deduplication check based on time/sender can be complex, so we just append.
        // We will optimistically render, skipping for now, so we only append if it's from the other person.
        if (m.sender_id === activeChatUserId) {
          appendMessageToDOM(m);
          scrollChatBottom();
        }
      }
    })
    .subscribe();
}

// Sending chat msg
chatAddMediaBtn.addEventListener('click', () => chatFileInput.click());
chatFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  chatMediaFile = file; chatMediaPreview.hidden = false;
  chatMediaPreview.innerHTML = `Attachment added: ${file.name} <button class="remove-media-btn" onclick="clearChatMedia(event)">&times;</button>`;
});

window.clearChatMedia = function(e) {
  if(e) e.preventDefault(); chatMediaFile = null; chatFileInput.value = ''; chatMediaPreview.hidden = true;
}

chatSendBtn.addEventListener('click', async () => {
  const content = chatInput.value.trim();
  if (!content && !chatMediaFile) return;
  if (!activeChatUserId) return;
  
  const tempContent = content; const tempMedia = chatMediaFile;
  chatInput.value = ''; clearChatMedia();
  
  try {
    let mUrl = null; let mType = null;
    if (tempMedia) {
      mUrl = await uploadFile(tempMedia, 'app-media');
      mType = tempMedia.type.startsWith('video') ? 'video' : 'image';
    }

    const newMsg = {
      sender_id: currentUser.id, receiver_id: activeChatUserId,
      content: tempContent, media_url: mUrl, media_type: mType, created_at: new Date().toISOString()
    };
    
    // Optimistic append
    appendMessageToDOM(newMsg);
    scrollChatBottom();

    const { error } = await supabaseClient.from('messages').insert(newMsg);
    if(error) throw error;
  } catch(err) { alert('Failed to send msg: '+err.message); }
});

chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') chatSendBtn.click(); });

// Voice Recording Logic
chatRecordBtn.addEventListener('click', async () => {
  if (isRecording) { stopRecording(); return; }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach(track => track.stop());
      await sendVoiceNote(audioBlob);
    };
    mediaRecorder.start();
    isRecording = true;
    chatRecordBtn.classList.add('recording');
  } catch(err) { alert('Microphone access denied or error: ' + err.message); }
});

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    isRecording = false;
    chatRecordBtn.classList.remove('recording');
  }
}

async function sendVoiceNote(audioBlob) {
  if (!activeChatUserId) return;
  const file = new File([audioBlob], "voice_note.webm", { type: 'audio/webm' });
  try {
    const url = await uploadFile(file, 'app-media');
    const newMsg = { sender_id: currentUser.id, receiver_id: activeChatUserId, content: '', media_url: url, media_type: 'audio', created_at: new Date().toISOString()};
    appendMessageToDOM(newMsg); scrollChatBottom();
    const { error } = await supabaseClient.from('messages').insert(newMsg);
    if (error) throw error;
  } catch(err) { alert('Voice note send failed: ' + err.message); }
}

// ---------------------------------------------------------------
// 10. GLOBAL EVENT LISTENERS
// ---------------------------------------------------------------
menuItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.dataset.target;
    if (target) switchView(target);
  });
});

[logoutBtn, mobileLogoutBtn].forEach(btn => btn?.addEventListener('click', logout));

// Social Login
googleLoginBtn?.addEventListener('click', () => signInWithOAuth('google'));
discordLoginBtn?.addEventListener('click', () => signInWithOAuth('discord'));
[postInput, usernameInput].forEach(inp => {
  inp?.addEventListener('input', function() {
    if (this.id === 'post-input') {
      const r = 500 - this.value.length;
      charRemaining.textContent = r;
      const c = charRemaining.closest('.char-count');
      c.className = 'char-count';
      if (r <= 50) c.classList.add('warn');
      if (r <= 10) c.classList.add('danger');
    }
  });
});

profileBackBtn.addEventListener('click', () => { window.history.back(); switchView('home-view'); });
chatBackBtn.addEventListener('click', () => { document.querySelector('.chat-layout').classList.remove('chat-active-open'); activeChatUserId = null;});
mobileComposeBtn.addEventListener('click', () => postInput.focus());

// ---------------------------------------------------------------
// SQL SCHEMA SETUP
// ---------------------------------------------------------------
/*
RUN THIS IN YOUR SUPABASE SQL EDITOR:

-- 1. Profiles & Posts are already assumed, but just to be sure, update posts to support media:
alter table public.posts add column if not exists media_url text;
alter table public.posts add column if not exists media_type text;

-- 2. Follows System
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(follower_id, following_id)
);
alter table public.follows enable row level security;
create policy "Anyone can view follows" on public.follows for select using (true);
create policy "Users can manage own follows" on public.follows for all using (auth.uid() = follower_id);

-- 3. Stories System
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);
alter table public.stories enable row level security;
create policy "Anyone can view active stories" on public.stories for select using (expires_at > now());
create policy "Users can insert own stories" on public.stories for insert with check (auth.uid() = user_id);

-- 4. Messages System (Real-time chat)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text,
  created_at timestamptz default now()
);
alter table public.messages enable row level security;
create policy "Users can participate in chats" on public.messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Users can send messages" on public.messages for insert with check (auth.uid() = sender_id);

-- 5. Enable Realtime on messages
alter table public.messages replica identity full;
-- In Publication configuration in Supabase, make sure 'messages' is added to supabase_realtime publication.

-- 6. Storage Bucket for Media
-- Go to Supabase > Storage
-- Create a new Public bucket named 'app-media'.
-- Add policies to allow Insert and Select for all authenticated users.
*/
