/* ================================================================
   PULSE — app.js
   Main application logic: Supabase auth, posts, session management
   ================================================================ */

// ---------------------------------------------------------------
// 1. SUPABASE CONFIGURATION
//    Replace the placeholders below with your actual project keys
//    from https://supabase.com → Project Settings → API
// ---------------------------------------------------------------
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';       // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';  // e.g. eyJhbGciOiJIUzI1NiIsIn...

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

// ---------------------------------------------------------------
// 3. APPLICATION STATE
// ---------------------------------------------------------------
let currentUser    = null;  // Supabase auth user object
let currentProfile = null;  // Row from our `profiles` table

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

  if (!username || username.length < 3) {
    alert('Username must be at least 3 characters and contain only letters, numbers, or underscores.');
    return;
  }

  setLoading(saveUsernameBtn, true);

  try {
    const { error } = await supabaseClient
      .from('profiles')
      .upsert({
        id:         currentUser.id,
        username:   username,
        avatar_url: currentUser.user_metadata?.avatar_url || null,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Re-fetch to populate currentProfile
    currentProfile = await fetchProfile(currentUser.id);
    initAppUI();
    showSection('app');

  } catch (err) {
    alert('Could not save username: ' + err.message);
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

  if (!content) {
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
    const { error } = await supabaseClient
      .from('posts')
      .insert({
        user_id:    currentUser.id,
        content:    content,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Clear textarea and refresh feed
    postInput.value         = '';
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

      card.innerHTML = `
        <div class="post-header">
          <div class="avatar-circle" aria-hidden="true">${initials}</div>
          <div class="post-meta">
            <div class="post-username">@${username}</div>
            <div class="post-time">${timeAgo}</div>
          </div>
        </div>
        <p class="post-content">${escapeHtml(post.content)}</p>
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

  // Navbar
  navUsernameDisplay.textContent = `@${username}`;
  setAvatarInitials(navAvatar, username);

  // Composer
  setAvatarInitials(composerAvatar, username);
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
saveUsernameBtn.addEventListener('click', () => {
  saveProfile(usernameInput.value);
});

usernameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveProfile(usernameInput.value);
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
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- posts table
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  created_at  timestamptz default now()
);

-- Row-level security: every authenticated user can read all posts
alter table public.profiles enable row level security;
alter table public.posts     enable row level security;

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

================================================================ */
