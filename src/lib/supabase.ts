
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Lazy initialization — avoid throwing during SSG/build when env vars are not yet available
let _supabase: SupabaseClient | null = null

function getClient(): SupabaseClient {
    if (!_supabase) {
        if (!supabaseUrl || !supabaseKey) {
            if (typeof window === 'undefined') {
                // During SSG build: return a chainable no-op proxy
                // This prevents crashes when Next.js pre-renders pages that import supabase
                return createNoOpProxy() as unknown as SupabaseClient
            }
            throw new Error('Variables d\'environnement Supabase manquantes')
        }
        _supabase = createClient(supabaseUrl, supabaseKey)
    }
    return _supabase
}

// No-op proxy that returns itself for any property access or function call
// This handles chained calls like supabase.from('x').select('*').eq('id', 1)
function createNoOpProxy(): any {
    const handler: ProxyHandler<any> = {
        get() {
            return (..._args: any[]) => createNoOpProxy()
        },
        apply() {
            return createNoOpProxy()
        }
    }
    const fn = function () { return createNoOpProxy() }
        // Add Promise-like behavior for awaited calls
        ; (fn as any).then = (resolve: any) => resolve({ data: null, error: null, count: null })
        ; (fn as any).data = null
        ; (fn as any).error = null
    return new Proxy(fn, handler)
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        const client = getClient()
        const value = (client as any)[prop]
        if (typeof value === 'function') {
            return value.bind(client)
        }
        return value
    }
})
