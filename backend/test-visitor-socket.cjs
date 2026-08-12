const { io } = require('socket.io-client');

const visitorToken = process.argv[2];
const conversationId = process.argv[3];

if (!visitorToken) {
  console.log('Falta visitorToken.');
  console.log(
    'Uso: node .\\test-visitor-socket.cjs <visitorToken> <conversationId>',
  );
  process.exit(1);
}

if (!conversationId) {
  console.log('Falta conversationId.');
  console.log(
    'Uso: node .\\test-visitor-socket.cjs <visitorToken> <conversationId>',
  );
  process.exit(1);
}

const socket = io('http://localhost:3000', {
  auth: {
    visitorToken,
  },
});

socket.on('connect', () => {
  console.log(
    'Socket conectado:',
    socket.id,
  );

  socket.emit(
    'conversation:join:visitor',
    {
      workspaceSlug:
        'empresa-demo-nueva',

      conversationId,
    },
  );
});

socket.on(
  'conversation:joined',
  (data) => {
    console.log(
      'Visitor unido correctamente:',
    );

    console.log(data);
  },
);

socket.on(
  'message:new',
  (message) => {
    console.log('');
    console.log(
      'Nuevo mensaje:',
    );

    console.log(message);
  },
);

socket.on(
  'exception',
  (error) => {
    console.log(
      'Error del socket:',
    );

    console.log(error);
  },
);

socket.on(
  'connect_error',
  (error) => {
    console.log(
      'Error de conexión:',
      error.message,
    );
  },
);

socket.on(
  'disconnect',
  (reason) => {
    console.log(
      'Socket desconectado:',
      reason,
    );
  },
);