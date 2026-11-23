require('dotenv').config();

// Test fetch-patch with JSON POST body
const { spawnSync } = require('child_process');

// Monkey-patch fetch exactly like fetch-patch does
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  const body = options.body;

  const headerEntries = typeof headers.forEach === 'function'
    ? (() => { const a = {}; headers.forEach((v, k) => a[k] = v); return a; })()
    : (headers || {});

  const headerLines = Object.entries(headerEntries)
    .map(([k, v]) => `    "${k.replace(/"/g, '`"')}" = "${(v || '').toString().replace(/"/g, '`"')}"`)
    .join("`n");

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
  if ($headers['Content-Type']) { $params['ContentType'] = $headers['Content-Type'] }
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
  ], { maxBuffer: 50 * 1024 * 1024, timeout: 35000, encoding: 'buffer' });

  const rawBuf = result.stdout || Buffer.alloc(0);
  const statusMatch = rawBuf.toString('utf8').match(/__STATUS__:(\d+)/);
  const ctypeMatch = rawBuf.toString('utf8').match(/__CTYPE__:(.+)/);
  let statusCode = 200, contentType = 'application/json';
  if (statusMatch) statusCode = parseInt(statusMatch[1]);
  if (ctypeMatch) contentType = ctypeMatch[1].trim();

  const beginMarker = Buffer.from('__BODYBEGIN__\n');
  const endMarker = Buffer.from('\n__BODYEND__');
  const beginIdx = rawBuf.indexOf(beginMarker) + beginMarker.length;
  const endIdx = rawBuf.indexOf(endMarker, beginIdx);
  let bodyBuf = Buffer.alloc(0);
  if (endIdx > beginIdx) bodyBuf = rawBuf.subarray(beginIdx, endIdx);

  console.log(`[patched] ${method} ${url.toString().substring(0, 60)} → ${statusCode}`);
  if (statusCode >= 400) console.log('  error body:', bodyBuf.toString('utf8').substring(0, 200));

  return new Response(bodyBuf, { status: statusCode, headers: { 'Content-Type': contentType } });
};

// Now test Resend
const { Resend } = require('resend');
(async () => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  console.log('\n=== Resend raw fetch to api.resend.com ===');
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Sotto <noreply@resend.dev>',
      to: ['del@resend.dev'],
      subject: 'Test',
      html: '<b>Hello</b>',
    }),
  });
  console.log('Status:', resp.status);
  console.log('Body:', (await resp.text()).substring(0, 300));
})();
