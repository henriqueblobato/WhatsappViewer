const { Client, Location, Poll, List, Buttons, LocalAuth } = require("whatsapp-web.js");
const fs = require('fs');
const qrcode = require("qrcode-terminal");
const mongoose = require("mongoose");
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ww';
console.log('MONGODB_URI:', MONGODB_URI);

async function mongoConnect() {
    try {
        await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to MongoDB");
    } catch (e) {
        console.error("Error connecting to MongoDB", e);
        process.exit(1);
    }
    return mongoose.connection.readyState;
}

mongoConnect().then(
    r => console.log('MongoDB connection state:', r)
).catch(
    e => console.error('Error connecting to MongoDB', e)
);

const messageSchema = new mongoose.Schema({
    from: { type: String },
    to: { type: String },
    body: { type: String },
    timestamp: { type: Number },
    hasMedia: { type: Boolean },
    deviceType: String,
    isForwarded: { type: Boolean, default: false },
    forwardedScore: Number,
    hasQuotedMsg: { type: Boolean, default: false },
    quotedMsg: {
        type: { type: String },
        body: String
    },
    isGif: { type: Boolean, default: false },
    mimetype: String
}, { timestamps: true });

const Message = mongoose.model('messages', messageSchema);

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: 'auth'
    })
});

client.initialize().then(() => console.log('INITIALIZED')).catch(e => console.error('ERROR', e));

client.on('loading_screen', (percent, message) => console.log('LOADING SCREEN', percent, message));

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR RECEIVED');
});

client.on('authenticated', () => console.log('AUTHENTICATED'));

client.on('auth_failure', msg => console.error('AUTHENTICATION FAILURE', msg));

client.on('ready', () => console.log('READY'));

function saveMedia(media, msgData) {
    if (!media || !msgData) {
        console.error('Invalid media or user data');
        return;
    }

    const { data, mimetype } = media;

    if (!data || !mimetype) {
        console.error('Invalid media object');
        return;
    }

    let extension = '';
    if (media.mimetype.includes('jpeg')) {
        extension = '.jpg';
    } else if (media.mimetype.includes('png')) {
        extension = '.png';
    } else if (media.mimetype.includes('mpeg')) {
        extension = '.mp3';
    } else if (media.mimetype.includes('ogg') || (media.mimetype.includes('mp4'))) {
        extension = '.mp4';
    } else {
        return;
    }

    const dataBuffer = Buffer.from(data, 'base64');
    const folder = 'medias';
    let userIdentification = msgData.pushname | msgData.number | msgData.from;
    userIdentification = userIdentification.toString();
    const userFolder = path.join(folder, userIdentification);
    const extensionFolder = `${userFolder}/${msgData.to}`

    if (!fs.existsSync(extensionFolder)) {
        fs.mkdirSync(extensionFolder, { recursive: true });
        console.log('Folder created:', extensionFolder);
    }

    const filename = `${Date.now()}${extension}`;
    const filePath = `${extensionFolder}/${filename}`

    fs.writeFile(filePath, dataBuffer, err => {
        if (err) {
            console.error('Error saving media:', err);
        } else {
            console.log(filePath);
        }
    });
}

client.on('message', async msg => {
    if (msg.hasMedia) {
        let user = await msg.getContact();
        const media = await msg.downloadMedia();

        if (user === 'status@broadcast') {
            user = {
                pushname: 'Status',
                number: 0o000000000
            }
        }
        let chat = await msg.getChat();
        let messageData = {
            from: msg.from,
            type: msg.type,
            pushname: user.pushname,
            number: user.number,
            to: chat.id,
            body: msg.body,
            timestamp: msg.timestamp,
            hasMedia: msg.hasMedia,
            deviceType: msg.deviceType,
            isForwarded: msg.isForwarded,
            hasQuotedMsg: msg.hasQuotedMsg,
            isGif: msg.isGif,
            chat: {
                id: chat.id,
                name: chat.name,
                isGroup: chat.isGroup
            }
        };
        // if the type is a sticker then, do not save the media
        if (msg.type !== 'sticker'){
            saveMedia(media, messageData);
        }
    }
});

function saveMessageOnDb(before, after) {
    let msg = after || before;
    let body = `${before ? before.body : ''} ${after ? after.body : ''}`;
    const message = new Message({
        from: msg.from,
        to: msg.to,
        body: body,
        timestamp: msg.timestamp,
        hasMedia: msg.hasMedia,
        deviceType: msg.deviceType,
        isForwarded: msg.isForwarded,
        forwardedScore: msg.forwardedScore,
        hasQuotedMsg: msg.hasQuotedMsg,
        quotedMsg: msg.quotedMsg,
        isGif: msg.isGif,
        mimetype: msg.mimetype
    });

    message.save().then(r => console.log('Message saved')).catch(e => console.error('Error saving message', e));
}

client.on('message_revoke_everyone', async (after, before) => {
    saveMessageOnDb(before, after);
    let from_user = await before.getContact();
    let chat = await before.getChat();
    console.log(`[${chat.name}] ${from_user.pushname | from_user.number} revoked a message: ${before.body | after.body}`);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});
