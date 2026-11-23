require('dotenv').config();
const redisClient = require('./src/lib/redis-client');

(async () => {
  console.log('UPSTASH_URL set:', !!process.env.UPSTASH_URL);
  console.log('UPSTASH_URL starts with:', process.env.UPSTASH_URL?.substring(0, 30));
  
  try {
    const r = await redisClient.connect();
    console.log('✅ Redis connect result:', JSON.stringify(r));
    console.log('   isAvailable:', redisClient.isAvailable());
    if (redisClient.isAvailable()) {
      const c = redisClient.getClient();
      const pong = await c.ping();
      console.log('   PING:', pong);
      await c.setex('test:from:express', 60, 'hello-world');
      const val = await c.get('test:from:express');
      console.log('   SET+GET:', val);
      await c.del('test:from:express');
      console.log('   DEL ✅');
    }
  } catch (e) {
    console.error('❌ Redis FAIL:', e.message);
    console.error(e.stack);
  }
})();
