// Supabase client — 用 service_role key (后端全能, 绕过 RLS)

const { createClient } = require('@supabase/supabase-js');

let client = null;

function getClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error('[supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY not set');
    process.exit(1);
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-cluster': 'sotto-channel' } },
  });

  return client;
}

async function verifyConnection() {
  try {
    const supabase = getClient();
    // 最简单的查询: categories 表行数 (不抛错就 OK)
    const { count, error } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    console.log(`[supabase] connected ✅ categories=${count ?? 'n/a'}`);
    return true;
  } catch (err) {
    console.error('[supabase] connection FAILED:', err.message);
    return false;
  }
}

module.exports = { getClient, verifyConnection };
