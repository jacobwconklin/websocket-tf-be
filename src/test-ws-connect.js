const ws = new WebSocket('ws://107.21.133.171/:5000');
ws.onopen = () => console.log('Connected!');