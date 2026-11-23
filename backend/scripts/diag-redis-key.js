// 诊断 Redis key 匹配问题
require('dotenv').config({ path: '.env.production' });
const crypto = require('crypto');

(async () => {
  const email = 'cigutattoo@163.com';
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  console.log('email:', email);
  console.log('emailHash:', emailHash);

  const redis = require('../src/lib/redis-client');
  await redis.connect();
  const r = redis.getClient();

  const CODE_TTL = 900;
  const code = '123456';

  const VERIFY_KEY = `verification:${emailHash}`;
  const ATTEMPTS_KEY = `verification:${emailHash}:attempts`;

  console.log('\n=== Manually store code ===');
  await r.setex(VERIFY_KEY, CODE_TTL, code);
  const stored = await r.get(VERIFY_KEY);
  console.log('SET:', VERIFY_KEY, '=', code);
  console.log('GET:', VERIFY_KEY, '=', stored);
  console.log('MATCH:', stored === code ? 'YES ✅' : 'NO ❌');

  console.log('\n=== Now call verification.verifyCode() ===');
  const verification = require('../src/lib/verification');
  try {
    await verification.verifyCode(emailHash, code);
    console.log('verifyCode PASSED ✅');
  } catch (e) {
    console.log('verifyCode FAILED:', e.message, 'code=', e.code);
  }

  // 再试一次错误码
  console.log('\n=== Try wrong code ===');
  try {
    await verification.verifyCode(emailHash, '000000');
    console.log('UNEXPECTED PASS');
  } catch (e) {
    console.log('verifyCode (wrong) failed as expected:', e.code);
  }

  // 清理
  await r.del(VERIFY_KEY);
  await r.del(ATTEMPTS_KEY);
})();
