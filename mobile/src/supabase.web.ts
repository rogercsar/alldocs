import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function createStub() {
  let currentUser: any = null;
  const listeners: Array<(ev: string, session: any) => void> = [];
  const notify = (ev: string) => listeners.forEach(fn => fn(ev, currentUser ? { user: currentUser } : null));

  return {
    auth: {
      getSession: async () => ({ data: { session: currentUser ? { user: currentUser } : null } }),
      getUser: async () => ({ data: { user: currentUser }, error: null as any }),
      onAuthStateChange: (cb: any) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: async () => { currentUser = null; notify('SIGNED_OUT'); },
      signUp: async (_params: any) => { currentUser = { id: 'web-demo' }; notify('SIGNED_IN'); return { data: { user: currentUser }, error: null };
      },
      signInWithPassword: async (_params: any) => { currentUser = { id: 'web-demo' }; notify('SIGNED_IN'); return { data: { session: { user: currentUser } }, error: null };
      },
      signInWithOtp: async (_params: any) => { currentUser = { id: 'web-demo' }; notify('SIGNED_IN'); return { data: { user: currentUser }, error: null };
      },
      resetPasswordForEmail: async (_email: string, _opts: any) => ({ data: { ok: true }, error: null }),
    },
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, _blob: any, _opts: any) => ({ data: { path }, error: null }),
        createSignedUrl: async (_path: string, _expires: number) => ({ data: { signedUrl: '' }, error: null }),
      }),
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: any) => ({
          order: (_field: string, _opts: any) => Promise.resolve({ data: [], error: null }),
        }),
      }),
      delete: () => ({ eq: (_col: string, _val: any) => ({ error: null }) }),
      upsert: (_payload: any, _conf: any) => ({ error: null }),
    }),
  } as any;
}

export const supabase: any = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          apikey: SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      },
    })
  : createStub();

export const STORAGE_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || 'documents';