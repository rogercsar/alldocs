export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => {},
    signUp: async (_params) => ({ data: null, error: { message: 'Auth indisponível no preview web' } }),
  },
  storage: {
    from: (_bucket) => ({
      upload: async (_path, _blob, _opts) => ({ data: { path: _path }, error: null }),
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

export const STORAGE_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_BUCKET || 'documents';