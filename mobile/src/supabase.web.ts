export const supabase: any = {
  auth: {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => {},
    signUp: async (_params: any) => ({ data: null, error: { message: 'Auth indisponível no preview web' } }),
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