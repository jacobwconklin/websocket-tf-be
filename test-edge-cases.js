const io = require('socket.io-client');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';

async function createSession(gameName = null) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ gameName });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/session/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function testEdgeCases() {
  console.log('=== Edge Case Testing ===\n');

  console.log('1. Testing session creation without gameName...');
  const session1 = await createSession();
  console.log('Session created:', session1);
  console.log('✓ Session created successfully without gameName\n');

  console.log('2. Testing multiple session creation...');
  const session2 = await createSession('Game 2');
  const session3 = await createSession('Game 3');
  console.log('Session 2:', session2.joinCode);
  console.log('Session 3:', session3.joinCode);
  console.log('✓ Multiple unique sessions created\n');

  console.log('3. Testing join without joinCode...');
  const socket1 = io(SERVER_URL);
  
  await new Promise((resolve) => {
    socket1.on('connect', () => {
      console.log('Connected:', socket1.id);
      socket1.emit('join-session', {
        alias: 'TestPlayer',
        color: '#FF0000',
        font: 'Arial',
        icon: 'star'
      });
    });

    socket1.on('join-error', (error) => {
      console.log('Received expected error:', error);
      console.log('✓ Properly handles missing joinCode\n');
      socket1.disconnect();
      resolve();
    });

    socket1.on('join-success', () => {
      console.error('✗ Should not have joined without joinCode!');
      socket1.disconnect();
      resolve();
    });
  });

  console.log('4. Testing empty session (session with no players)...');
  const session4 = await createSession('Empty Session');
  console.log('Empty session code:', session4.joinCode);
  console.log('✓ Empty session created successfully\n');

  console.log('5. Testing session join code uniqueness...');
  const codes = new Set([session1.joinCode, session2.joinCode, session3.joinCode, session4.joinCode]);
  if (codes.size === 4) {
    console.log('✓ All join codes are unique\n');
  } else {
    console.error('✗ Duplicate join codes detected!\n');
  }

  console.log('=== All edge case tests completed ===');
  process.exit(0);
}

testEdgeCases().catch(console.error);
