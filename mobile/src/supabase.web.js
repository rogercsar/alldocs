export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => {},
    // Simula sucesso no cadastro para preview web
    signUp: async (_params) => ({ data: { user: { id: 'web-demo' } }, error: null }),
    // Adiciona métodos esperados pelo app no web
    signInWithPassword: async (_params) => ({ data: { session: { user: { id: 'web-demo' } } }, error: null }),
    signInWithOtp: async (_params) => ({ data: { user: { id: 'web-demo' } }, error: null }),
    resetPasswordForEmail: async (_email, _opts) => ({ data: { ok: true }, error: null }),
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