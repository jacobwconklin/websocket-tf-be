const express = require('express');
const cors = require('cors');
const { createSession } = require('./sessionManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/session/create', (req, res) => {
  try {
    const { gameName } = req.body;
    const session = createSession(gameName || null);
    
    res.status(201).json({
      success: true,
      joinCode: session.joinCode,
      gameName: session.gameName
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
