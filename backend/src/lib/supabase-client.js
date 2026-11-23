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
    // 简单查询: categories 表取 1 行 (比 count+head 更兼容)
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    if (error) throw error;
    console.log(`[supabase] connected ✅ sample=${data?.length ?? 0}`);
    return { ok: true };
  } catch (err) {
    console.error('[supabase] connection FAILED:', err.message);
    console.error('[supabase] stack:', err.stack?.substring(0, 500));
    return { ok: false, error: err.message };
  }
}

module.exports = { getClient, verifyConnection };
