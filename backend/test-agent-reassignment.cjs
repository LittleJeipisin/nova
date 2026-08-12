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
  console.log('Room unida correctamente:');
  console.log(data);
  console.log('');
  console.log('Esperando reasignación...');
});

socket.on('conversation:updated', (conversation) => {
  console.log('');
  console.log('CONVERSACIÓN ACTUALIZADA');
  console.log(conversation);
});

socket.on('conversation:removed', (data) => {
  console.log('');
  console.log('================================');
  console.log('CONVERSACIÓN REMOVIDA');
  console.log('================================');
  console.log(data);
});

socket.on('exception', (error) => {
  console.log('Error del socket:');
  console.log(error);
});

socket.on('connect_error', (error) => {
  console.log('Error de conexión:');
  console.log(error.message);
});