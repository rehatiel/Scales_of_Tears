// SSE connection registry
// Maps playerId → Express response object for server-sent event streams.

const connections = new Map();

function register(playerId, res) {
  const key = String(playerId);
  const existing = connections.get(key);
  if (existing) {
    try { existing.end(); } catch {}
  }
  connections.set(key, res);
}

function unregister(playerId) {
  connections.delete(String(playerId));
}

// Push a full screen object to a connected player. Returns true if delivered.
function push(playerId, data) {
  const res = connections.get(String(playerId));
  if (!res) return false;
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    connections.delete(String(playerId));
    return false;
  }
}

// Push a non-disruptive toast notification (does not replace the current screen).
// message supports LORD color codes.
function pushToast(playerId, message) {
  return push(playerId, { toast: message });
}

function isConnected(playerId) {
  return connections.has(String(playerId));
}

module.exports = { register, unregister, push, pushToast, isConnected };
