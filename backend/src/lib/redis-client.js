// Redis client — Upstash REST API v2
// 格式: POST https://host/{command}/{key}
// 认证: Authorization: Bearer {token} header
// 返回: JSON {"result": "..."}
//
// 走 fetch-patch.js 自动代理 PowerShell Invoke-WebRequest

let isConnected = false;
let baseUrl = '';
let authToken = '';

function _parseUpstashUrl(redisUrl) {
  const m = redisUrl.match(/^redis:\/\/:([^@]+)@([^:]+)/);
  if (!m) return null;
  return { token: m[1], host: m[2], restUrl: `https://${m[2]}` };
}

function _shouldSkip(url) {
  if (!url) return true;
  return url.includes('REPLACE') || url.includes('placeholder') || url.trim() === '';
}

// Parse Upstash REST response: {"result":"value"} → value
function _parse(text) {
  if (!text) return null;
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object' && 'result' in obj) {
      const v = obj.result;
      if (v === null) return null;
      if (typeof v === 'string' && v.startsWith('(nil)')) return null;
      return v;
    }
  } catch {}
  return text;
}

async function _restGet(path) {
  const resp = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Upstash ${resp.status}: ${text}`);
  return _parse(text);
}

async function _restPost(path, body) {
  const init = {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  };
  if (body !== undefined && body !== null) {
    // Upstash REST API: body MUST be plain text (NOT JSON — JSON.stringify adds extra quotes!)
    init.headers['Content-Type'] = 'text/plain';
    init.body = String(body);
  }
  const fullUrl = `${baseUrl}${path}`;
  const resp = await fetch(fullUrl, init);
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Upstash ${resp.status}: ${text}`);
  return _parse(text);
}

async function connect() {
  const url = process.env.UPSTASH_URL;

  if (_shouldSkip(url)) {
    console.warn('[redis] 跳过 (占位 URL 或未配置)');
    return null;
  }

  const parsed = _parseUpstashUrl(url);
  if (!parsed) throw new Error('UPSTASH_URL 格式错误');

  baseUrl = parsed.restUrl;
  authToken = parsed.token;

  try {
    const pong = await _restPost('/ping');
    isConnected = true;
    console.log(`[redis] connected ✅ (Upstash REST ${parsed.host}) PING=${pong}`);
    return { type: 'rest', host: parsed.host };
  } catch (err) {
    throw new Error(`Upstash Redis FAILED: ${err.message}`);
  }
}

function isAvailable() { return isConnected; }

// Encode Redis key for URL path — preserve colons (common in Redis keys),
// but still encode truly problematic chars (space, /, ?, #, [, ], %)
function _enc(key) {
  return encodeURIComponent(key)
    .replace(/%3A/g, ':')   // restore colons
    .replace(/%2F/g, '/');  // restore slashes if any
}

// Upstash REST API v2 per-command endpoints
const api = {
  async ping()   { return _restPost('/ping'); },
  async set(k,v) { return _restPost(`/set/${_enc(k)}`, v); },
  async setex(k,t,v) {
    // Upstash REST: SET + EXPIRE 分开调 (更可靠)
    await _restPost(`/set/${_enc(k)}`, v);
    return _restPost(`/expire/${_enc(k)}`, String(t));
  },
  async get(k) {
    const r = await _restGet(`/get/${_enc(k)}`);
    return r === null || r === '' ? null : r;
  },
  async del(k)  { return _restPost(`/del/${_enc(k)}`); },
  async expire(k, sec) { return _restPost(`/expire/${_enc(k)}`, String(sec)); },
  async ttl(k) {
    const n = parseInt(await _restGet(`/ttl/${_enc(k)}`), 10);
    return isNaN(n) ? 0 : n;
  },
  async incr(k) {
    const n = parseInt(await _restPost(`/incr/${_enc(k)}`), 10);
    return isNaN(n) ? 0 : n;
  },
};

const memoryFallback = new Map();

module.exports = {
  connect,
  isAvailable,
  memoryFallback,
  getClient() {
    if (!isConnected) return null;
    return {
      ping:  () => api.ping(),
      set:   (k, v) => api.set(k, v),
      setex: (k, t, v) => api.setex(k, t, v),
      get:   (k) => api.get(k),
      del:   (k) => api.del(k),
      expire: (k, s) => api.expire(k, s),
      ttl:   (k) => api.ttl(k),
      incr:  (k) => api.incr(k),
    };
  },
};
