/* global supabase */
(() => {
  'use strict';

  let clientPromise;
  let activeUser = null;

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

  async function syncLocalUser(sessionUser, profileData = null) {
    activeUser = sessionUser || null;
    if (!sessionUser) {
      localStorage.removeItem('yooop-user');
      return;
    }

    const metadata = sessionUser.user_metadata || {};
    const p = profileData || {};
    localStorage.setItem('yooop-user', JSON.stringify({
      id: sessionUser.id,
      email: sessionUser.email,
      first: p.first_name || metadata.first_name || metadata.name || sessionUser.email?.split('@')[0] || '',
      last: p.last_name || metadata.last_name || '',
      phone: p.phone || '',
      address: p.address_line1 || '',
      city: p.city || '',
      state: p.state || '',
      zip: p.postal_code || ''
    }));
  }

  async function loadProfile(user) {
    if (!user) return null;
    const client = await getClient();
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    await syncLocalUser(user, data);
    return data;
  }

  function fillAccountForm(profileData, user) {
    const form = document.getElementById('accountForm');
    if (!form) return;
    const values = {
      first: profileData?.first_name || user?.user_metadata?.first_name || '',
      last: profileData?.last_name || user?.user_metadata?.last_name || '',
      email: user?.email || '',
      phone: profileData?.phone || '',
      address: profileData?.address_line1 || '',
      city: profileData?.city || '',
      state: profileData?.state || '',
      zip: profileData?.postal_code || ''
    };
    Object.entries(values).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field) field.value = value;
    });
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
      const profileData = await loadProfile(result.user);
      await syncLocalUser(result.user, profileData);
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

  window.saveProfile = async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"], button:not([type])');

    try {
      if (submit) submit.disabled = true;
      const client = await getClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        location.href = 'login.html';
        return;
      }

      const values = Object.fromEntries(new FormData(form));
      const payload = {
        id: user.id,
        first_name: values.first || null,
        last_name: values.last || null,
        phone: values.phone || null,
        address_line1: values.address || null,
        city: values.city || null,
        state: values.state || null,
        postal_code: values.zip || null,
        updated_at: new Date().toISOString()
      };

      const { data: profileData, error } = await client
        .from('profiles')
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;

      await client.auth.updateUser({
        data: {
          first_name: values.first || '',
          last_name: values.last || ''
        }
      });

      await syncLocalUser(user, profileData);
      if (typeof window.toast === 'function') window.toast('Profile saved');
      else alert('Profile saved');
    } catch (error) {
      alert(error.message || 'Unable to save profile.');
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
      const sessionUser = data.session?.user || null;
      const profileData = sessionUser ? await loadProfile(sessionUser) : null;
      await syncLocalUser(sessionUser, profileData);
      fillAccountForm(profileData, sessionUser);

      client.auth.onAuthStateChange(async (_event, session) => {
        const user = session?.user || null;
        const p = user ? await loadProfile(user).catch(() => null) : null;
        await syncLocalUser(user, p);
      });
    } catch (error) {
      console.info('Supabase not active yet:', error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', initializeSession);
})();
