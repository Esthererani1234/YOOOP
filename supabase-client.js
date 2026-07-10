/* global supabase */
(() => {
  'use strict';

  let clientPromise;

  function showAuthMessage(message, type = 'info') {
    let box = document.getElementById('authMessage');
    if (!box) {
      box = document.createElement('div');
      box.id = 'authMessage';
      box.className = 'notice';
      box.style.marginTop = '14px';
      const card = document.querySelector('.auth-card');
      card?.appendChild(box);
    }
    box.textContent = message;
    box.dataset.type = type;
  }

  async function getClient() {
    if (clientPromise) return clientPromise;

    clientPromise = (async () => {
      if (!window.supabase?.createClient) {
        throw new Error('Supabase library failed to load.');
      }

      const response = await fetch('/api/supabase-config');
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.configured) {
        throw new Error(config.error || 'Supabase is not configured.');
      }

      return window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    })();

    return clientPromise;
  }

  async function syncLocalUser(sessionUser) {
    if (!sessionUser) {
      localStorage.removeItem('yooop-user');
      return;
    }

    const metadata = sessionUser.user_metadata || {};
    localStorage.setItem('yooop-user', JSON.stringify({
      id: sessionUser.id,
      email: sessionUser.email,
      first: metadata.first_name || metadata.name || sessionUser.email?.split('@')[0] || '',
      last: metadata.last_name || ''
    }));
  }

  window.getSupabaseClient = getClient;

  window.login = async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('button[type="submit"], button:not([type])');

    try {
      if (submit) submit.disabled = true;
      showAuthMessage('Signing you in…');
      const client = await getClient();
      const { data: result, error } = await client.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });
      if (error) throw error;
      await syncLocalUser(result.user);
      location.href = 'account.html';
    } catch (error) {
      showAuthMessage(error.message || 'Unable to sign in.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  };

  window.register = async function register(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('button[type="submit"], button:not([type])');

    try {
      if (submit) submit.disabled = true;
      showAuthMessage('Creating your account…');
      const client = await getClient();
      const { data: result, error } = await client.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.first || '',
            last_name: data.last || ''
          },
          emailRedirectTo: `${location.origin}/account.html`
        }
      });
      if (error) throw error;
      await syncLocalUser(result.user);

      if (result.session) {
        location.href = 'account.html';
      } else {
        showAuthMessage('Account created. Check your email to confirm your address.', 'success');
        form.reset();
      }
    } catch (error) {
      showAuthMessage(error.message || 'Unable to create account.', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  };

  window.logout = async function logout() {
    try {
      const client = await getClient();
      await client.auth.signOut();
    } catch (error) {
      console.error(error);
    } finally {
      localStorage.removeItem('yooop-user');
      location.href = 'login.html';
    }
  };

  async function initializeSession() {
    try {
      const client = await getClient();
      const { data } = await client.auth.getSession();
      await syncLocalUser(data.session?.user || null);
      client.auth.onAuthStateChange((_event, session) => {
        syncLocalUser(session?.user || null);
      });
    } catch (error) {
      console.info('Supabase not active yet:', error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', initializeSession);
})();
