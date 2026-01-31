const Session = require('./models/Session');
const { generateJoinCode } = require('./utils/codeGenerator');

const sessions = new Map();

function createSession(gameName = null) {
  let joinCode;
  do {
    joinCode = generateJoinCode();
  } while (sessions.has(joinCode));

  const session = new Session(joinCode, gameName);
  sessions.set(joinCode, session);
  return session;
}

function getSession(joinCode) {
  return sessions.get(joinCode);
}

function addPlayerToSession(joinCode, player) {
  const session = sessions.get(joinCode);
  if (!session) {
    return null;
  }
  session.addPlayer(player);
  return session;
}

function removePlayerFromSession(joinCode, playerId) {
  const session = sessions.get(joinCode);
  if (!session) {
    return null;
  }
  session.removePlayer(playerId);
  
  if (session.players.length === 0) {
    sessions.delete(joinCode);
  }
  
  return session;
}

module.exports = {
  createSession,
  getSession,
  addPlayerToSession,
  removePlayerFromSession
};
