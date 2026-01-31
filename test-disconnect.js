const io = require('socket.io-client');
const http = require('http');

const SERVER_URL = 'http://localhost:5000';

async function createSession() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ gameName: 'Disconnect Test' });
    
    const options = {
      hostname: 'localhost',
      port: 5000,
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

async function testDisconnect() {
  console.log('Creating session...');
  const sessionResponse = await createSession();
  console.log('Session created:', sessionResponse);

  const joinCode = sessionResponse.joinCode;

  console.log('\nConnecting Player 1...');
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
    console.log('Player 1 joined successfully. Players:', data.players.length);

    console.log('\nConnecting Player 2...');
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
      console.log('Player 2 joined successfully. Players:', data.players.length);

      console.log('\nDisconnecting Player 2...');
      setTimeout(() => {
        socket2.disconnect();
      }, 500);
    });
  });

  socket1.on('player-joined', (data) => {
    console.log('Player 1 received player-joined event. Total players:', data.players.length);
  });

  socket1.on('player-left', (data) => {
    console.log('Player 1 received player-left event. Remaining players:', data.players.length);
    console.log('Left player ID:', data.playerId);
    
    console.log('\nDisconnect test passed!');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });
}

testDisconnect().catch(console.error);
