import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function createStub() {
  let currentUser = null;
  const listeners = [];
  const notify = (ev) => listeners.forEach(fn => fn(ev, currentUser ? { user: currentUser } : null));

  return {
    auth: {
      getSession: async () => ({ data: { session: currentUser ? { user: currentUser } : null } }),
      getUser: async () => ({ data: { user: currentUser }, error: null }),
      onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe: () => {} } } }; },
      signOut: async () => { currentUser = null; notify('SIGNED_OUT'); },
      signUp: async (_params) => { currentUser = { id: 'web-demo' }; notify('SIGNED_IN'); return { data: { user: currentUser }, error: null }; },
      signInWithPassword: async (_params) => { currentUser = { id: 'web-demo' }; notify('SIGNED_IN'); return { data: { session: { user: currentUser } }, error: null }; },
      signInWithOtp: async (_params) => { currentUser = { id: 'web-demo' }; notify('SIGNED_IN'); return { data: { user: currentUser }, error: null }; },
      resetPasswordForEmail: async (_email, _opts) => ({ data: { ok: true }, error: null }),
    },
    storage: {
      from: (_bucket) => ({
        upload: async (path, _blob, _opts) => ({ data: { path }, error: null }),
        createSignedUrl: async (_path, _expires) => ({ data: { signedUrl: '' }, error: null }),
      }),
    },
    from: (_table) => ({
      select: (_cols) => ({
        eq: (_col, _val) => ({
          order: (_field, _opts) => Promise.resolve({ data: [], error: null }),
        }),
      }),
      delete: () => ({ eq: (_col, _val) => ({ error: null }) }),
      upsert: (_payload, _conf) => ({ error: null }),
    }),
  };
}

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createStub();

export const STORAGE_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_BUCKET || 'documents';