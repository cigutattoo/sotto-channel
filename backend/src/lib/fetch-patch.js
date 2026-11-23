// fetch-patch.js
// 本地开发 monkey-patch globalThis.fetch，让它内部用 PowerShell Invoke-WebRequest
// 解决中国大陆环境 Node.js 直连海外 HTTPS 全部 ECONNRESET 的问题
//
// 生产环境（RAILWAY_ENVIRONMENT / NODE_ENV=production）不受影响 — 直接用原生 fetch

const { spawnSync } = require('child_process');

if (process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function patchedFetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = options.headers || {};
    const body = options.body;

    // 解析 URL 和 headers 为 PowerShell 参数
    const headerEntries = typeof headers.forEach === 'function'
      ? (() => { const a = {}; headers.forEach((v, k) => a[k] = v); return a; })()
      : (headers || {});

    // Separate Content-Type from headers — use $params['ContentType'] instead
    // (PowerShell Invoke-WebRequest doesn't like Content-Type in BOTH Headers hashtable AND params)
    const ctypeHeader = headerEntries['Content-Type'] || headerEntries['content-type'] || null;
    const filteredHeaders = { ...headerEntries };
    delete filteredHeaders['Content-Type'];
    delete filteredHeaders['content-type'];

    const headerLines = Object.entries(filteredHeaders)
      .map(([k, v]) => `    "${k.replace(/"/g, '`"')}" = "${(v || '').toString().replace(/"/g, '`"')}"`)
      .join('\n');

    const escapedUrl = url.toString().replace(/'/g, "''");
    const escapedBody = (body || '').toString().replace(/'/g, "''");

    const psScript = `
$ProgressPreference = 'SilentlyContinue'
try {
  $headers = @{
${headerLines}
  }
  $params = @{
    Uri = '${escapedUrl}'
    Method = '${method}'
    Headers = $headers
    TimeoutSec = 30
    UseBasicParsing = $true
  }
  if ('${escapedBody}') { $params['Body'] = '${escapedBody}' }
  if ('${ctypeHeader ? ctypeHeader.replace(/'/g, "''") : ''}') { $params['ContentType'] = '${ctypeHeader ? ctypeHeader.replace(/'/g, "''") : ''}' }
  $r = Invoke-WebRequest @params
  Write-Host "__STATUS__:$($r.StatusCode)"
  Write-Host "__CTYPE__:$($r.Headers['Content-Type'])"
  Write-Host "__BODYBEGIN__"
  $bytes = if ($r.Content -is [byte[]]) { $r.Content } else { [Text.Encoding]::UTF8.GetBytes($r.Content) }
  [Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)
  Write-Host ""
  Write-Host "__BODYEND__"
} catch {
  $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 502 }
  Write-Host "__STATUS__:$code"
  Write-Host "__CTYPE__:application/json"
  Write-Host "__BODYBEGIN__"
  $errMsg = $_.Exception.Message.Replace([char]34, '')
  $errBytes = [Text.Encoding]::UTF8.GetBytes("{""error"":{""message"":""PS: $errMsg""}}")
  [Console]::OpenStandardOutput().Write($errBytes, 0, $errBytes.Length)
  Write-Host ""
  Write-Host "__BODYEND__"
}
`;

    const result = spawnSync('powershell', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-Command', psScript,
    ], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 35000,
      encoding: 'buffer',
    });

    const stdout = result.stdout ? result.stdout.toString('utf8') : '';

    // Parse markers
    const lines = stdout.split('\n');
    let statusCode = 200;
    let contentType = 'application/json';
    let bodyBuf = Buffer.alloc(0);

    const statusMatch = stdout.match(/__STATUS__:(\d+)/);
    if (statusMatch) statusCode = parseInt(statusMatch[1]);
    const ctypeMatch = stdout.match(/__CTYPE__:(.+)/);
    if (ctypeMatch) contentType = ctypeMatch[1].trim();

    // Extract body between markers from raw buffer
    const rawBuf = result.stdout || Buffer.alloc(0);
    const beginMarker = Buffer.from('__BODYBEGIN__\n');
    const endMarker = Buffer.from('\n__BODYEND__');
    const beginIdx = rawBuf.indexOf(beginMarker) + beginMarker.length;
    const endIdx = rawBuf.indexOf(endMarker, beginIdx);
    if (endIdx > beginIdx) bodyBuf = rawBuf.subarray(beginIdx, endIdx);

    // 1% 比例的性能提示
    if (Math.random() < 0.01) {
      console.log(`[fetch-patch] ${method} ${url.toString().substring(0, 80)} → ${statusCode}`);
    }

    // Return a fetch-compatible Response
    return new Response(bodyBuf, {
      status: statusCode,
      headers: { 'Content-Type': contentType },
    });
  };

  console.log('[fetch-patch] ✅ globalThis.fetch patched (PS Invoke-WebRequest)');
  console.log('[fetch-patch]    Will NOT patch in production / Railway');
}

module.exports = { originalFetch: typeof originalFetch !== 'undefined' ? originalFetch : null };
