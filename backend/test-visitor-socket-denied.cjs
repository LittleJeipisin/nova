const { io } = require('socket.io-client');

const visitorToken = process.argv[2];

const options = {};

if (visitorToken) {
  options.auth = {
    visitorToken,
  };
}

const socket = io(
  'http://localhost:3000',
  options,
);

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

      conversationId:
        '29fb2ef8-e384-4f02-a423-20ce01012ef7',
    },
  );
});

socket.on(
  'conversation:joined',
  (data) => {
    console.log(
      'ERROR: logró entrar cuando no debería',
    );

    console.log(data);

    socket.disconnect();
    process.exit(1);
  },
);

socket.on(
  'exception',
  (error) => {
    console.log(
      'Acceso rechazado correctamente:',
    );

    console.log(error);

    socket.disconnect();
    process.exit(0);
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