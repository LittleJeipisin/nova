const { io } = require('socket.io-client');

const visitorToken = process.argv[2];

if (!visitorToken) {
  console.log('Debes pasar el visitorToken como argumento.');
  process.exit(1);
}

const socket = io('http://localhost:3000', {
  auth: {
    visitorToken,
  },
});

socket.on('connect', () => {
  console.log('Socket conectado:', socket.id);

  socket.emit('conversation:join:visitor', {
    workspaceSlug: 'empresa-demo-nueva',
    conversationId: '29fb2ef8-e384-4f02-a423-20ce01012ef7',
  });
});

socket.on('conversation:joined', (data) => {
  console.log('Conversación unida correctamente:');
  console.log(data);

  console.log('');
  console.log('Esperando mensajes en tiempo real...');
});

socket.on('message:new', (message) => {
  console.log('');
  console.log('==============================');
  console.log('NUEVO MENSAJE EN TIEMPO REAL');
  console.log('==============================');
  console.log(message);
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