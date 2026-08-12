const { io } = require('socket.io-client');

const agentToken = process.argv[2];

if (!agentToken) {
  console.log('Debes pasar el token del agente.');
  process.exit(1);
}

const socket = io('http://localhost:3000', {
  auth: {
    token: agentToken,
  },
});

socket.on('connect', () => {
  console.log('Socket conectado:', socket.id);

  socket.emit('workspace:join', {
    workspaceId: '0ae6c639-ba81-418d-a476-e3da14468e16',
  });
});

socket.on('workspace:joined', (data) => {
  console.log('Workspace unido correctamente:');
  console.log(data);

  socket.disconnect();
});

socket.on('exception', (error) => {
  console.log('Acceso rechazado:');
  console.log(error);

  socket.disconnect();
});

socket.on('connect_error', (error) => {
  console.log('Error de conexión:');
  console.log(error.message);
});

setTimeout(() => {
  if (socket.connected) {
    console.log('La prueba terminó sin respuesta');
    socket.disconnect();
  }
}, 5000);