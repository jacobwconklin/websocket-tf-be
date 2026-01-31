const io = require('socket.io-client');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';

async function createSession() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ gameName: 'Test Game' });
    
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

async function testSocketConnection() {
  console.log('Creating session...');
  const sessionResponse = await createSession();
  console.log('Session created:', sessionResponse);

  const joinCode = sessionResponse.joinCode;

  console.log('\nTesting valid join code with Player 1...');
  const socket1 = io(SERVER_URL);

  socket1.on('connect', () => {
    console.log('Player 1 connected:', socket1.id);
    socket1.emit('join-session', {
      joinCode: joinCode,
      alias: 'Player1',
      color: '#FF0000',
      font: 'Arial',
      icon: 'star'
    });
  });

  socket1.on('join-success', (data) => {
    console.log('Player 1 joined successfully:', data);

    console.log('\nTesting Player 2 joining the same session...');
    const socket2 = io(SERVER_URL);

    socket2.on('connect', () => {
      console.log('Player 2 connected:', socket2.id);
      socket2.emit('join-session', {
        joinCode: joinCode,
        alias: 'Player2',
        color: '#00FF00',
        font: 'Verdana',
        icon: 'heart'
      });
    });

    socket2.on('join-success', (data) => {
      console.log('Player 2 joined successfully:', data);
    });

    socket2.on('join-error', (error) => {
      console.error('Player 2 join error:', error);
    });
  });

  socket1.on('player-joined', (data) => {
    console.log('Player 1 received player-joined event:', data);
  });

  socket1.on('join-error', (error) => {
    console.error('Player 1 join error:', error);
  });

  console.log('\nTesting invalid join code...');
  const socket3 = io(SERVER_URL);
  
  socket3.on('connect', () => {
    console.log('Player 3 connected:', socket3.id);
    socket3.emit('join-session', {
      joinCode: 'INVALID1',
      alias: 'Player3',
      color: '#0000FF',
      font: 'Times',
      icon: 'circle'
    });
  });

  socket3.on('join-error', (error) => {
    console.log('Player 3 received expected error:', error);
  });

  socket3.on('join-success', (data) => {
    console.error('Player 3 should not have joined with invalid code!');
  });

  setTimeout(() => {
    console.log('\nTest completed. Exiting...');
    process.exit(0);
  }, 5000);
}

testSocketConnection().catch(console.error);
