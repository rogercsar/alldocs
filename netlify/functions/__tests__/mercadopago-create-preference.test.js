const assert = require('assert');

async function runTest() {
  require('dotenv').config({ path: 'netlify/.env' });
  process.env.MP_ACCESS_TOKEN = 'test_token';
  const { handler } = require('../mercadopago-create-preference');
  try {
    const event = {
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({}),
    };

    const response = await handler(event);

    assert.strictEqual(response.statusCode, 400, 'Expected status code to be 400 for missing planId');
    const body = JSON.parse(response.body);
    assert.deepStrictEqual(body, { error: 'Missing planId' }, 'Expected error message for missing planId');

    console.log('Test passed: Missing planId');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest();
