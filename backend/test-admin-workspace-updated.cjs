const { io } = require('socket.io-client');

const adminToken = process.argv[2];

if (!adminToken) {
  console.log('Debes pasar el token del admin.');
  process.exit(1);
}

const socket = io('http://localhost:3000', {
  auth: {
    token: adminToken,
  },
});

socket.on('connect', () => {
  console.log('Socket conectado:', socket.id);

  socket.emit('workspace:join', {
    workspaceId: '0ae6c639-ba81-418d-a476-e3da14468e16',
  });
});

socket.on('workspace:joined', (data) => {
  console.log('Room general unida correctamente:');
  console.log(data);

  console.log('');
  console.log('Esperando conversation:updated...');
});

socket.on('conversation:updated', (conversation) => {
  console.log('');
  console.log('================================');
  console.log('CONVERSACIÓN NUEVA/ACTUALIZADA');
  console.log('================================');
  console.log(conversation);
});

socket.on('exception', (error) => {
  console.log('Error del socket:');
  console.log(error);
});

socket.on('connect_error', (error) => {
  console.log('Error de conexión:');
  console.log(error.message);
});

socket.on('disconnect', (reason) => {
  console.log('Socket desconectado:', reason);
});