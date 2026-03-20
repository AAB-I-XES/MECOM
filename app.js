/* ================================================================
   PULSE — app.js
   Main application logic: Supabase auth, posts, session management
   ================================================================ */

// ---------------------------------------------------------------
// 1. SUPABASE CONFIGURATION
//    Replace the placeholders below with your actual project keys
//    from https://supabase.com → Project Settings → API
// ---------------------------------------------------------------
const SUPABASE_URL      = 'https://lukbyowagziiyvfmdtlm.supabase.co';       // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_1DDELP4WU_UagI-qQ2Zjmg_gr_V9sQ9';  // e.g. eyJhbGciOiJIUzI1NiIsIn...

// Initialise the Supabase client (using the CDN global `supabase`)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------
// 2. DOM ELEMENT REFERENCES
// ---------------------------------------------------------------

// ── Sections ──
const loginSection    = document.getElementById('login-section');
const usernameSection = document.getElementById('username-section');
const appSection      = document.getElementById('app-section');

// ── OTP Login ──
const otpStep1         = document.getElementById('otp-step-1');
const otpStep2         = document.getElementById('otp-step-2');
const emailInput       = document.getElementById('email-input');
const sendOtpBtn       = document.getElementById('send-otp-btn');
const otpInput         = document.getElementById('otp-input');
const verifyOtpBtn     = document.getElementById('verify-otp-btn');
const backToEmailBtn   = document.getElementById('back-to-email-btn');
const otpEmailDisplay  = document.getElementById('otp-email-display');

// ── Social Login ──
const googleLoginBtn   = document.getElementById('google-login-btn');
const facebookLoginBtn = document.getElementById('facebook-login-btn');
const discordLoginBtn  = document.getElementById('discord-login-btn');

// ── Onboarding ──
const usernameInput    = document.getElementById('username-input');
const saveUsernameBtn  = document.getElementById('save-username-btn');
const avatarUpload     = document.getElementById('avatar-upload');
const avatarPreview    = document.getElementById('avatar-preview');
const bioInput         = document.getElementById('bio-input');

// ── App UI ──
const navUsernameDisplay = document.getElementById('nav-username-display');
const navAvatar          = document.getElementById('nav-avatar');
const composerAvatar     = document.getElementById('composer-avatar');
const postInput          = document.getElementById('post-input');
const postBtn            = document.getElementById('post-btn');
const charRemaining      = document.getElementById('char-remaining');
const feedContainer      = document.getElementById('feed-container');
const feedLoading        = document.getElementById('feed-loading');
const logoutBtn          = document.getElementById('logout-btn');

const postMediaUpload     = document.getElementById('post-media-upload');
const postMediaPreviewCtn = document.getElementById('post-media-preview-container');
const postMediaPreview    = document.getElementById('post-media-preview');
const postVideoPreview    = document.getElementById('post-video-preview');
const removePostMediaBtn  = document.getElementById('remove-post-media-btn');

// ── Navigation & Chat ──
const menuHome     = document.getElementById('menu-home');
const menuMessages = document.getElementById('menu-messages');
const feedCenter   = document.getElementById('feed-center');
const chatCenter   = document.getElementById('chat-center');
const sidebarRight = document.getElementById('sidebar-right');

const chatUserList          = document.getElementById('chat-user-list');
const chatHeader            = document.getElementById('chat-header');
const chatMessages          = document.getElementById('chat-messages');
const chatComposer          = document.getElementById('chat-composer');
const chatInput             = document.getElementById('chat-input');
const chatSendBtn           = document.getElementById('chat-send-btn');
const chatMediaUpload       = document.getElementById('chat-media-upload');
const chatMicBtn            = document.getElementById('chat-mic-btn');
const chatMediaPreviewCtn   = document.getElementById('chat-media-preview-container');
const chatMediaPreviewName  = document.getElementById('chat-media-preview-name');
const chatMediaRemoveBtn    = document.getElementById('chat-media-remove-btn');

// ---------------------------------------------------------------
// 3. APPLICATION STATE
// ---------------------------------------------------------------
let currentUser    = null;  // Supabase auth user object
let currentProfile = null;  // Row from our `profiles` table
let selectedPostMedia = null;
let selectedPostMediaType = null;

let activeChatUserId = null;
let chatMessagesSubscription = null;
let selectedChatMedia = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecordingVoiceNote = false;

// ---------------------------------------------------------------
// 4. UTILITY HELPERS
// ---------------------------------------------------------------

/**
 * setLoading — toggles a button between its normal and loading state.
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 */
function setLoading(btn, loading) {
  if (loading) {
    btn.classList.add('is-loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('is-loading');
    btn.disabled = false;
  }
}

/**
 * showSection — hide all top-level sections and show the requested one.
 * @param {'login'|'username'|'app'} section
 */
function showSection(section) {
  loginSection.hidden    = section !== 'login';
  usernameSection.hidden = section !== 'username';
  appSection.hidden      = section !== 'app';
}

/**
 * formatDate — returns a human-friendly relative time string.
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  const date  = new Date(isoString);
  const now   = new Date();
  const diffMs = now - date;
  const diffS  = Math.floor(diffMs / 1000);
  const diffM  = Math.floor(diffS / 60);
  const diffH  = Math.floor(diffM / 60);
  const diffD  = Math.floor(diffH / 24);

  if (diffS < 60)  return 'just now';
  if (diffM < 60)  return `${diffM}m ago`;
  if (diffH < 24)  return `${diffH}h ago`;
  if (diffD < 7)   return `${diffD}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * getInitials — returns up to 2 uppercase letters from a username.
 * @param {string} username
 * @returns {string}
 */
function getInitials(username) {
  if (!username) return '?';
  const parts = username.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * setAvatarInitials — fills an avatar element with coloured initials.
 * @param {HTMLElement} el
 * @param {string} username
 */
function setAvatarInitials(el, username) {
  if (!el) return;
  el.textContent = getInitials(username);
}

// ---------------------------------------------------------------
// 5. AUTHENTICATION
// ---------------------------------------------------------------

/**
 * Send a magic-link / OTP to the user's email via Supabase.
 */
async function sendOtp() {
  const email = emailInput.value.trim();

  if (!email) {
    alert('Please enter a valid email address.');
    return;
  }

  setLoading(sendOtpBtn, true);

  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        // The user will receive a 6-digit code (OTP), not a magic link click.
        // Set shouldCreateUser to true so new accounts are created automatically.
        shouldCreateUser: true,
      },
    });

    if (error) throw error;

    // Show OTP verification step
    otpEmailDisplay.textContent = email;
    otpStep1.hidden = true;
    otpStep2.hidden = false;

  } catch (err) {
    alert('Could not send code: ' + err.message);
  } finally {
    setLoading(sendOtpBtn, false);
  }
}

/**
 * Verify the 6-digit OTP entered by the user.
 */
async function verifyOtp() {
  const email = emailInput.value.trim();
  const token = otpInput.value.trim();

  if (!token || token.length < 6) {
    alert('Please enter the 6-digit code.');
    return;
  }

  setLoading(verifyOtpBtn, true);

  try {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) throw error;

    // Session is now active; onAuthStateChange will fire and handle UI update.

  } catch (err) {
    alert('Verification failed: ' + err.message);
  } finally {
    setLoading(verifyOtpBtn, false);
  }
}

/**
 * OAuth login — works for Google, Facebook, Discord.
 * @param {'google'|'facebook'|'discord'} provider
 */
async function signInWithOAuth(provider) {
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.href, // redirect back to the same page after OAuth
      },
    });
    if (error) throw error;
  } catch (err) {
    alert(`${provider} login failed: ` + err.message);
  }
}

/**
 * Sign the current user out and reset the UI.
 */
async function logout() {
  try {
    await supabaseClient.auth.signOut();
    currentUser    = null;
    currentProfile = null;
    showSection('login');
    // Reset OTP form back to step 1
    otpStep1.hidden = false;
    otpStep2.hidden = true;
    otpInput.value  = '';
    emailInput.value = '';
  } catch (err) {
    alert('Logout error: ' + err.message);
  }
}

// ---------------------------------------------------------------
// 6. USER PROFILES
// ---------------------------------------------------------------

/**
 * Fetch the profile row for the given user ID.
 * Returns null if no profile exists yet.
 * @param {string} userId
 * @returns {Object|null}
 */
async function fetchProfile(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = row not found — that's expected for new users
    console.error('Error fetching profile:', error.message);
  }

  return data || null;
}

/**
 * Create or update the profile row for the current user.
 * @param {string} username
 */
async function saveProfile(username) {
  if (!currentUser) return;

  username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const bio = bioInput.value.trim();
  const avatarFile = avatarUpload.files[0];

  if (!username || username.length < 3) {
    alert('Username must be at least 3 characters and contain only letters, numbers, or underscores.');
    return;
  }

  setLoading(saveUsernameBtn, true);

  try {
    let finalAvatarUrl = currentUser.user_metadata?.avatar_url || null;

    // Upload new avatar if selected
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop();
      const fileName = `${currentUser.id}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabaseClient.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      finalAvatarUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabaseClient
      .from('profiles')
      .upsert({
        id:         currentUser.id,
        username:   username,
        bio:        bio,
        avatar_url: finalAvatarUrl,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Re-fetch to populate currentProfile
    currentProfile = await fetchProfile(currentUser.id);
    initAppUI();
    showSection('app');

  } catch (err) {
    alert('Could not save profile: ' + err.message);
  } finally {
    setLoading(saveUsernameBtn, false);
  }
}

// ---------------------------------------------------------------
// 7. POSTS
// ---------------------------------------------------------------

/**
 * Create a new post in the `posts` table.
 */
async function createPost() {
  const content = postInput.value.trim();

  if (!content && !selectedPostMedia) {
    alert('Post cannot be empty.');
    postInput.focus();
    return;
  }

  if (content.length > 500) {
    alert('Post exceeds 500 characters.');
    return;
  }

  setLoading(postBtn, true);

  try {
    let mediaUrl = null;
    let mediaType = null;

    if (selectedPostMedia) {
      const fileExt = selectedPostMedia.name.split('.').pop();
      const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('post_media')
        .upload(fileName, selectedPostMedia, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from('post_media')
        .getPublicUrl(fileName);
      
      mediaUrl = publicUrlData.publicUrl;
      mediaType = selectedPostMediaType;
    }

    const { error } = await supabaseClient
      .from('posts')
      .insert({
        user_id:    currentUser.id,
        content:    content,
        media_url:  mediaUrl,
        media_type: mediaType,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Clear textarea and refresh feed
    postInput.value         = '';
    
    // reset media
    selectedPostMedia = null;
    selectedPostMediaType = null;
    postMediaUpload.value = '';
    postMediaPreviewCtn.style.display = 'none';
    postMediaPreview.src = '';
    postVideoPreview.src = '';

    charRemaining.textContent = '500';
    charRemaining.closest('.char-count').className = 'char-count';

    await fetchAndRenderPosts();

  } catch (err) {
    alert('Could not create post: ' + err.message);
  } finally {
    setLoading(postBtn, false);
  }
}

/**
 * Fetch all posts (newest first) with their author profile.
 * Renders them into #feed-container.
 */
async function fetchAndRenderPosts() {
  // Show spinner while loading
  feedLoading.hidden = false;

  try {
    // We join posts with profiles to get the username
    const { data: posts, error } = await supabaseClient
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        user_id,
        media_url,
        media_type,
        profiles ( username, avatar_url )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Remove old post cards (but keep the loading indicator in DOM)
    const existingCards = feedContainer.querySelectorAll('.post-card');
    existingCards.forEach(c => c.remove());

    feedLoading.hidden = true;

    if (!posts || posts.length === 0) {
      // Show empty state
      const emptyEl = document.createElement('div');
      emptyEl.className = 'feed-empty';
      emptyEl.innerHTML = `
        <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" opacity="0.4">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>No posts yet — be the first!</span>
      `;
      feedContainer.appendChild(emptyEl);
      return;
    }

    // Render each post
    posts.forEach(post => {
      const username   = post.profiles?.username || 'Anonymous';
      const initials   = getInitials(username);
      const timeAgo    = formatDate(post.created_at);
      const isOwn      = post.user_id === currentUser?.id;

      const card = document.createElement('article');
      card.className  = 'post-card';
      card.dataset.id = post.id;

      let mediaHtml = '';
      if (post.media_url) {
        if (post.media_type === 'video') {
           mediaHtml = `<video src="${post.media_url}" controls style="max-height: 400px; width: 100%; border-radius: var(--radius-sm); margin-top: var(--space-sm);"></video>`;
        } else {
           mediaHtml = `<img src="${post.media_url}" style="max-height: 400px; width: 100%; object-fit: cover; border-radius: var(--radius-sm); margin-top: var(--space-sm);" />`;
        }
      }

      card.innerHTML = `
        <div class="post-header">
          <div class="avatar-circle" aria-hidden="true" style="${post.profiles?.avatar_url ? `background: url('${post.profiles.avatar_url}'); background-size: cover; background-position: center; border: 1px solid var(--color-border);` : ''}">${post.profiles?.avatar_url ? '' : initials}</div>
          <div class="post-meta">
            <div class="post-username">@${username}</div>
            <div class="post-time">${timeAgo}</div>
          </div>
        </div>
        <p class="post-content">${escapeHtml(post.content)}</p>
        ${mediaHtml}
        <div class="post-actions">
          <button class="post-action-btn like-btn" data-id="${post.id}" title="Like">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            Like
          </button>
          <button class="post-action-btn" title="Comment" disabled>
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Reply
          </button>
          ${isOwn ? `
            <button class="post-action-btn delete-btn" data-id="${post.id}" title="Delete post">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              Delete
            </button>
          ` : ''}
        </div>
      `;

      feedContainer.appendChild(card);
    });

    // Attach delete handlers
    feedContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deletePost(btn.dataset.id));
    });

  } catch (err) {
    feedLoading.hidden = true;
    alert('Could not load posts: ' + err.message);
  }
}

/**
 * Delete a post owned by the current user.
 * @param {string} postId
 */
async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;

  try {
    const { error } = await supabaseClient
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', currentUser.id); // safety: only delete own posts

    if (error) throw error;

    // Remove the card from DOM immediately
    const card = feedContainer.querySelector(`[data-id="${postId}"]`);
    if (card) card.remove();

  } catch (err) {
    alert('Could not delete post: ' + err.message);
  }
}

/**
 * Escape HTML special characters to prevent XSS when rendering user content.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------
// 8. APP UI INITIALISATION
// ---------------------------------------------------------------

/**
 * Populate the navbar and composer with the logged-in user's info.
 */
function initAppUI() {
  if (!currentProfile) return;

  const username = currentProfile.username;
  const avatarUrl = currentProfile.avatar_url;

  // Navbar
  navUsernameDisplay.textContent = `@${username}`;
  if (avatarUrl) {
    navAvatar.style.backgroundImage = `url('${avatarUrl}')`;
    navAvatar.style.backgroundSize = 'cover';
    navAvatar.style.backgroundPosition = 'center';
    navAvatar.textContent = '';
  } else {
    setAvatarInitials(navAvatar, username);
  }

  // Composer
  if (avatarUrl) {
    composerAvatar.style.backgroundImage = `url('${avatarUrl}')`;
    composerAvatar.style.backgroundSize = 'cover';
    composerAvatar.style.backgroundPosition = 'center';
    composerAvatar.textContent = '';
  } else {
    setAvatarInitials(composerAvatar, username);
  }
}

// ---------------------------------------------------------------
// 9. EVENT LISTENERS
// ---------------------------------------------------------------

// ── OTP flow ──
sendOtpBtn.addEventListener('click', sendOtp);

emailInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendOtp();
});

verifyOtpBtn.addEventListener('click', verifyOtp);

otpInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') verifyOtp();
});

backToEmailBtn.addEventListener('click', () => {
  otpStep1.hidden = false;
  otpStep2.hidden = true;
  otpInput.value  = '';
});

// ── Social OAuth ──
googleLoginBtn.addEventListener('click',   () => signInWithOAuth('google'));
facebookLoginBtn.addEventListener('click', () => signInWithOAuth('facebook'));
discordLoginBtn.addEventListener('click',  () => signInWithOAuth('discord'));

// ── Username onboarding ──
avatarUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      avatarPreview.style.backgroundImage = `url(${e.target.result})`;
      avatarPreview.innerHTML = '';
      avatarPreview.style.border = 'none';
      avatarPreview.style.backgroundSize = 'cover';
      avatarPreview.style.backgroundPosition = 'center';
    };
    reader.readAsDataURL(file);
  }
});

saveUsernameBtn.addEventListener('click', () => {
  saveProfile(usernameInput.value);
});

usernameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveProfile(usernameInput.value);
});

postMediaUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  selectedPostMedia = file;
  postMediaPreviewCtn.style.display = 'block';

  if (file.type.startsWith('video/')) {
    selectedPostMediaType = 'video';
    postMediaPreview.style.display = 'none';
    postVideoPreview.style.display = 'block';
    
    // Create an object URL for preview
    const url = URL.createObjectURL(file);
    postVideoPreview.src = url;
  } else {
    selectedPostMediaType = 'image';
    postVideoPreview.style.display = 'none';
    postMediaPreview.style.display = 'block';
    
    const reader = new FileReader();
    reader.onload = (e) => {
      postMediaPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});

removePostMediaBtn.addEventListener('click', () => {
  selectedPostMedia = null;
  selectedPostMediaType = null;
  postMediaUpload.value = '';
  postMediaPreviewCtn.style.display = 'none';
  postMediaPreview.src = '';
  postVideoPreview.src = '';
});

// ── Posting ──
postBtn.addEventListener('click', createPost);

postInput.addEventListener('keydown', e => {
  // Ctrl+Enter or Cmd+Enter to submit
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    createPost();
  }
});

// Character counter
postInput.addEventListener('input', () => {
  const remaining = 500 - postInput.value.length;
  charRemaining.textContent = remaining;

  const counterEl = charRemaining.closest('.char-count');
  counterEl.className = 'char-count';
  if (remaining <= 50)  counterEl.classList.add('warn');
  if (remaining <= 10)  counterEl.classList.add('danger');
});

// ── Navigation ──
if (menuHome && menuMessages) {
  menuHome.addEventListener('click', (e) => {
    e.preventDefault();
    menuHome.classList.add('active');
    menuMessages.classList.remove('active');
    feedCenter.style.display = 'flex';
    chatCenter.style.display = 'none';
    if (window.innerWidth >= 1024) sidebarRight.style.display = 'block';
  });

  menuMessages.addEventListener('click', (e) => {
    e.preventDefault();
    menuMessages.classList.add('active');
    menuHome.classList.remove('active');
    feedCenter.style.display = 'none';
    sidebarRight.style.display = 'none';
    chatCenter.style.display = 'flex';
    loadChatUsers();
  });
}

// ── Chats ──

async function loadChatUsers() {
  try {
    const { data: users, error } = await supabaseClient
      .from('profiles')
      .select('id, username, avatar_url')
      .neq('id', currentUser.id)
      .order('username');
    if (error) throw error;
    
    chatUserList.innerHTML = '';
    users.forEach(u => {
      const initials = getInitials(u.username);
      const el = document.createElement('div');
      el.style.cssText = 'padding: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; border-radius: var(--radius-sm); margin-bottom: 2px; transition: background 0.15s;';
      el.className = 'chat-user-item';
      
      el.innerHTML = `
        <div class="avatar-circle" style="width: 32px; height: 32px; font-size: 0.75rem; border: 1px solid var(--color-border); ${u.avatar_url ? `background: url('${u.avatar_url}') center/cover;` : ''}">${u.avatar_url ? '' : initials}</div>
        <div style="font-weight: 600; font-size: 0.9rem;">@${u.username}</div>
      `;
      el.addEventListener('mouseover', () => { el.style.background = 'var(--color-border)' });
      el.addEventListener('mouseout', () => { if (activeChatUserId !== u.id) el.style.background = 'transparent' });
      
      el.addEventListener('click', () => {
        document.querySelectorAll('.chat-user-item').forEach(i => i.style.background = 'transparent');
        el.style.background = 'var(--color-border)';
        openChat(u);
      });
      chatUserList.appendChild(el);
    });
  } catch(err) {
    console.error('Error loading users', err);
  }
}

async function openChat(user) {
  activeChatUserId = user.id;
  const initials = getInitials(user.username);
  
  chatHeader.innerHTML = `
    <div class="avatar-circle" style="width: 32px; height: 32px; font-size: 0.75rem; border: 1px solid var(--color-border); ${user.avatar_url ? `background: url('${user.avatar_url}') center/cover;` : ''}">${user.avatar_url ? '' : initials}</div>
    <span>@${user.username}</span>
  `;
  chatComposer.style.visibility = 'visible';
  chatMessages.innerHTML = '<div style="margin: auto; color: var(--color-text-muted);">Loading messages...</div>';
  
  clearChatMedia();
  
  if (chatMessagesSubscription) supabaseClient.removeChannel(chatMessagesSubscription);

  const roomId = [currentUser.id, user.id].sort().join('_');
  await fetchChatMessages(roomId);
  
  chatMessagesSubscription = supabaseClient
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, payload => {
       renderMessage(payload.new, true);
    })
    .subscribe();
}

async function fetchChatMessages(roomId) {
  try {
    const { data: msgs, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    chatMessages.innerHTML = '';
    msgs.forEach(m => renderMessage(m, false));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch(err) {
    console.error('Error fetching messages', err);
  }
}

function renderMessage(msg, scroll = true) {
  const isMine = msg.sender_id === currentUser.id;
  const el = document.createElement('div');
  el.style.cssText = `max-width: 70%; padding: 10px 14px; border-radius: var(--radius-md); font-size: 0.95rem; line-height: 1.4; align-self: ${isMine ? 'flex-end' : 'flex-start'}; background: ${isMine ? 'var(--color-accent)' : 'var(--color-border)'}; color: ${isMine ? '#fff' : 'var(--color-text)'};`;
  
  let mediaHtml = '';
  if (msg.media_url) {
    if (msg.media_type === 'audio') {
      mediaHtml = `<audio src="${msg.media_url}" controls style="width: 250px; height: 32px; outline: none; margin-bottom: 6px;"></audio><br/>`;
    } else if (msg.media_type === 'video') {
      mediaHtml = `<video src="${msg.media_url}" controls style="max-width: 100%; border-radius: var(--radius-sm); margin-bottom: 6px;"></video><br/>`;
    } else {
      mediaHtml = `<img src="${msg.media_url}" style="max-width: 100%; border-radius: var(--radius-sm); margin-bottom: 6px;" /><br/>`;
    }
  }
  
  let contentHtml = msg.content ? escapeHtml(msg.content) : '';
  el.innerHTML = mediaHtml + contentHtml;
  
  chatMessages.appendChild(el);
  if (scroll) chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatMediaUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  selectedChatMedia = file;
  chatMediaPreviewName.textContent = `Attached: ${file.name}`;
  chatMediaPreviewCtn.style.display = 'flex';
});

function clearChatMedia() {
  selectedChatMedia = null;
  chatMediaUpload.value = '';
  chatMediaPreviewCtn.style.display = 'none';
  chatMediaPreviewName.textContent = '';
}

chatMediaRemoveBtn.addEventListener('click', clearChatMedia);

chatMicBtn.addEventListener('click', async () => {
  if (isRecordingVoiceNote) {
    mediaRecorder.stop();
    isRecordingVoiceNote = false;
    chatMicBtn.style.color = 'inherit';
    chatMicBtn.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`;
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const file = new File([audioBlob], `voicenote_${Date.now()}.webm`, { type: 'audio/webm' });
        selectedChatMedia = file;
        chatMediaPreviewName.textContent = `Attached: Voice Note (${(audioBlob.size/1024).toFixed(1)}KB)`;
        chatMediaPreviewCtn.style.display = 'flex';
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      isRecordingVoiceNote = true;
      chatMicBtn.style.color = '#EF4444';
      chatMicBtn.innerHTML = `<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>`;
    } catch(err) {
      alert("Microphone access denied");
    }
  }
});

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChatMessage();
});
chatSendBtn.addEventListener('click', sendChatMessage);

async function sendChatMessage() {
  if (!activeChatUserId) return;
  const content = chatInput.value.trim();
  
  if (!content && !selectedChatMedia) return;
  
  chatSendBtn.disabled = true;
  chatSendBtn.textContent = '...';
  
  try {
    let mediaUrl = null;
    let mediaType = null;

    if (selectedChatMedia) {
      const isVoice = selectedChatMedia.name.startsWith('voicenote');
      const fileExt = selectedChatMedia.name.split('.').pop();
      const fileName = `${currentUser.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('chat_media')
        .upload(fileName, selectedChatMedia, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from('chat_media')
        .getPublicUrl(fileName);
      
      mediaUrl = publicUrlData.publicUrl;
      if (isVoice || selectedChatMedia.type.startsWith('audio/')) mediaType = 'audio';
      else if (selectedChatMedia.type.startsWith('video/')) mediaType = 'video';
      else mediaType = 'photo';
    }

    const roomId = [currentUser.id, activeChatUserId].sort().join('_');

    const { error } = await supabaseClient
      .from('messages')
      .insert({
        room_id:    roomId,
        sender_id:  currentUser.id,
        content:    content,
        media_url:  mediaUrl,
        media_type: mediaType,
      });

    if (error) throw error;

    chatInput.value = '';
    clearChatMedia();
    
    // UI rendering happens automatically via Postgres Subscription
  } catch (err) {
    alert('Could not send message: ' + err.message);
  } finally {
    chatSendBtn.disabled = false;
    chatSendBtn.textContent = 'Send';
  }
}

// ── Logout ──
logoutBtn.addEventListener('click', logout);

// ---------------------------------------------------------------
// 10. SESSION MANAGEMENT & AUTH STATE LISTENER
// ---------------------------------------------------------------

/**
 * Called whenever the auth state changes (login, logout, token refresh).
 * This is the central routing function that decides which screen to show.
 */
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth event:', event);

  if (session?.user) {
    currentUser = session.user;

    // Try to load the user's profile from the database
    currentProfile = await fetchProfile(currentUser.id);

    if (!currentProfile) {
      // New user — ask them to set a username
      showSection('username');
    } else {
      // Existing user — go straight to the feed
      initAppUI();
      showSection('app');
      await fetchAndRenderPosts();
    }

  } else {
    // No active session — show login screen
    currentUser    = null;
    currentProfile = null;
    showSection('login');
  }
});

/**
 * On initial page load, check for an existing session
 * (e.g. returning user with a valid refresh token, or an OAuth callback redirect).
 */
(async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  // onAuthStateChange fires on page load too, but we call getSession() here
  // as an extra safety net for the initial render.
  if (!session) {
    showSection('login');
  }
  // If there IS a session, onAuthStateChange will handle routing.
})();

/* ================================================================
   SUPABASE SCHEMA (run this SQL in your Supabase SQL editor)
   ================================================================

-- profiles table
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  avatar_url  text,
  bio         text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- posts table
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  media_url   text,
  media_type  text,
  created_at  timestamptz default now()
);

-- messages table
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  content     text,
  media_url   text,
  media_type  text,
  created_at  timestamptz default now()
);

-- Row-level security: every authenticated user can read all posts
alter table public.profiles enable row level security;
alter table public.posts     enable row level security;
alter table public.messages  enable row level security;

create policy "Anyone can read profiles"
  on public.profiles for select using (true);

create policy "Users can upsert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Anyone can read posts"
  on public.posts for select using (true);

create policy "Authenticated users can insert posts"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- Storage bucket for avatars (run this if you don't use the dashboard)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy "Avatar images are publicly accessible."
  on storage.objects for select using ( bucket_id = 'avatars' );

create policy "Anyone can upload an avatar."
  on storage.objects for insert with check ( bucket_id = 'avatars' );

create policy "Anyone can update their own avatar."
  on storage.objects for update using ( bucket_id = 'avatars' and auth.uid() = owner );

-- Storage bucket for post media
insert into storage.buckets (id, name, public) values ('post_media', 'post_media', true);

create policy "Post media is publicly accessible."
  on storage.objects for select using ( bucket_id = 'post_media' );

create policy "Anyone can upload post media."
  on storage.objects for insert with check ( bucket_id = 'post_media' and auth.role() = 'authenticated' );

create policy "Users can delete own post media."
  on storage.objects for delete using ( bucket_id = 'post_media' and auth.uid() = owner );

-- Enable real-time for messages
drop publication if exists supabase_realtime;
create publication supabase_realtime for table messages;

create policy "Users can read all messages (simplified)"
  on public.messages for select using (true);

create policy "Users can insert messages"
  on public.messages for insert with check (auth.uid() = sender_id);

-- Storage bucket for chat media
insert into storage.buckets (id, name, public) values ('chat_media', 'chat_media', true);

create policy "Chat media is publicly accessible."
  on storage.objects for select using ( bucket_id = 'chat_media' );

create policy "Anyone can upload chat media."
  on storage.objects for insert with check ( bucket_id = 'chat_media' and auth.role() = 'authenticated' );

================================================================ */
