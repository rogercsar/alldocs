export const supabase: any = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => {},
    // Simula sucesso no cadastro para preview web
    signUp: async (_params: any) => ({ data: { user: { id: 'web-demo' } }, error: null }),
    // Adiciona métodos esperados pelo app no web
    signInWithPassword: async (_params: any) => ({ data: { session: { user: { id: 'web-demo' } } }, error: null }),
    signInWithOtp: async (_params: any) => ({ data: { user: { id: 'web-demo' } }, error: null }),
    resetPasswordForEmail: async (_email: string, _opts: any) => ({ data: { ok: true }, error: null }),
  },
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, _blob: any, _opts: any) => ({ data: { path: _path }, error: null }),
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
};

export const STORAGE_BUCKET = process.env.EXPO_PUBLIC_SUPABASE_BUCKET || 'documents';