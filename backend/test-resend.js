require('dotenv').config();
const { Resend } = require('resend');

(async () => {
  const apiKey = process.env.RESEND_API_KEY;
  const resend = new Resend(apiKey);

  // Try 1: resend default dev domain
  console.log('[1] Try from: noreply@resend.dev → to: del@resend.dev (Resend dev inbox)...');
  const r1 = await resend.emails.send({
    from: 'Sotto <noreply@resend.dev>',
    to: ['del@resend.dev'],
    subject: 'Test from Sotto',
    html: '<h1>Hello from Sotto</h1>',
  });
  console.log(r1.error ? '❌' : '✅ id:', r1.data?.id);

  // Try 2: resend.dev to your email
  console.log('\n[2] Try from: noreply@resend.dev → to: cigutattoo@gmail.com...');
  const r2 = await resend.emails.send({
    from: 'Sotto <noreply@resend.dev>',
    to: ['cigutattoo@gmail.com'],
    subject: 'Test from Sotto',
    html: '<h1>Hello from Sotto</h1>',
  });
  console.log(r2.error ? '❌ ' + r2.error.message : '✅ id:', r2.data?.id);
})();
