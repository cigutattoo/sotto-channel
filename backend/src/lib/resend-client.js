// Resend email client — 直接走 REST API (绕过 Resend SDK fetch 不兼容问题)

const RESEND_API = 'https://api.resend.com';

function _sendViaRest({ apiKey, from, to, subject, html, text }) {
  return fetch(`${RESEND_API}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || '',
      text: text || '',
    }),
  }).then(async (resp) => {
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(`Resend ${resp.status}: ${body.message || JSON.stringify(body)}`);
    }
    return body; // { id: '...' }
  });
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not set');
    return { id: 'skipped-no-key' };
  }

  const from = process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev';

  try {
    const data = await _sendViaRest({
      apiKey,
      from: `Sotto 频道目录 <${from}>`,
      to,
      subject,
      html,
      text,
    });
    console.log(`[resend] ✅ sent → ${to} (id=${data.id})`);
    return data;
  } catch (err) {
    console.error('[resend] ❌ send failed:', err.message);
    throw err;
  }
}

// --- 邮件模板 ---

function verificationEmail(code) {
  return {
    subject: '【Sotto 频道目录】请验证您的邮箱',
    text: `您的验证码: ${code}\n15 分钟内有效。\n\n如果不是您本人操作,请忽略此邮件。`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#fff;background:#111;border-radius:12px">
<h2 style="color:#fff;margin:0 0 16px">邮箱验证</h2>
<p style="color:#999;margin:0 0 8px">您的验证码:</p>
<p style="font-size:48px;font-weight:700;letter-spacing:8px;text-align:center;margin:0 0 24px;color:#6ee7b7">${code}</p>
<p style="color:#666;font-size:12px;margin:0">此验证码 15 分钟内有效。如果不是您本人操作,请忽略此邮件。</p>
</div>`,
  };
}

function channelApprovedEmail(channelName, channelUrl) {
  return {
    subject: `🎉 您的频道「${channelName}」已通过审核`,
    text: `您提交的频道「${channelName}」已通过审核。\n查看: ${channelUrl}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#fff;background:#111;border-radius:12px">
<h2 style="margin:0 0 12px;color:#6ee7b7">🎉 审核通过</h2>
<p style="margin:0 0 8px">您提交的频道「<strong>${channelName}</strong>」已通过审核:</p>
<p style="margin:0"><a href="${channelUrl}" style="color:#60a5fa">${channelUrl}</a></p>
</div>`,
  };
}

function channelRejectedEmail(channelName, reasonText, editUrl) {
  return {
    subject: `您的频道「${channelName}」未通过审核`,
    text: `未通过原因: ${reasonText}\n修改后重新提交: ${editUrl}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#fff;background:#111;border-radius:12px">
<h2 style="margin:0 0 12px;color:#fca5a5">审核未通过</h2>
<p style="margin:0 0 8px">您的频道「<strong>${channelName}</strong>」未通过审核。</p>
<p style="margin:0 0 16px;color:#999">原因: ${reasonText}</p>
<p style="margin:0"><a href="${editUrl}" style="color:#60a5fa">修改后重新提交</a></p>
</div>`,
  };
}

module.exports = { sendEmail, verificationEmail, channelApprovedEmail, channelRejectedEmail };
