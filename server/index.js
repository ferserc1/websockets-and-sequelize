import express from 'express';
import logger from 'morgan';

import { Server } from 'socket.io';
import { createServer } from 'node:http';

// Base de datos: Sequelize para independizar del servidor
import { Sequelize, DataTypes } from 'sequelize';

// En este caso usamos sqlite3 en memoria (se perderán los cambios al salir)
const sequelize = new Sequelize('sqlite::memory:');

// Creamos el esquema
const Message = sequelize.define('Message', {
    id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
    },
    message: DataTypes.STRING
});

// Sincronizamos el esquema con la base de datos: si las tablas
// no existen, se crearán
await sequelize.sync();


const port = process.env.PORT ?? 3000;

const app = express();

// Creamos un servidor http de node para pasarlo a io.Server
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {

    }
});

// Con esto ya podemos escuchar conexiones
io.on('connection', async (socket) => {

    socket.on('disconnect', () => {
        console.log("Client disconnected");
    });

    console.log("User connected");

    socket.on('chat message', async msg => {
        try {
            const count = await Message.count();
            const result = await Message.create({
                message: msg
            });
            io.emit('chat message', msg, count);
        }
        catch (err) {
            console.error(err);
            return;
        }
    });

    if (!socket.recovered) {
        try {
            const results = await Message.findAndCountAll({
                offset: socket.handshake.auth?.serverOffset ?? 0
            });
            results.rows.forEach((row,i) => {
                socket.emit('chat message', row.message, (socket.handshake.auth?.serverOffset ?? 0) + i);
            });
        }
        catch (err) {
            console.error(err);
        }
    }
});

app.use(logger('dev'));

app.get('/', (req,res) => {
    res.sendFile(process.cwd() + '/client/index.html');
});

// Escuchamos en el server, en lugar de en app
// app.listen(port, ...
server.listen(port, "0.0.0.0", () => {
    console.log(`Server running at port ${port}`);
});
