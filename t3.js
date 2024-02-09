const { Client, Location, Poll, List, Buttons, LocalAuth } = require("whatsapp-web.js");
const fs = require('fs');
const qrcode = require("qrcode-terminal");
const mongoose = require("mongoose");

require('dotenv').config();

MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ww';

async function mongoConnect() {
    await mongoose.connect(
        MONGODB_URI,
        {useNewUrlParser: true, useUnifiedTopology: true}
    ).then(r => console.log("Connected to MongoDB")).catch( (e) => {
            console.error("Error connecting to MongoDB", e);
            process.exit(1);
        }
    )
    return mongoose.connection.readyState;
}

// run mongoConnect function on async mode
mongoConnect().then(
    r => console.log('MongoDB connected', r)
).catch((e) => {
    console.error('Error connecting to MongoDB', e);
    process.exit(1);
})


const messageSchema = new mongoose.Schema({
    from: { type: String, required: true },
    to: { type: String, required: true },
    body: { type: String, required: true },
    timestamp: { type: Number, required: true },
    hasMedia: { type: Boolean, default: false },
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


client.initialize().then(r => console.log('INITIALIZED', r)).catch(e => console.error('ERROR', e));

client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR RECEIVED');

});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {

    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', () => {
    console.log('READY');
});

function saveMedia(media, user) {
    const dataBuffer = Buffer.from(media.data, 'base64');
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

    let folder = 'medias';
    let userIdentification = user.pushname || user.number;
    const userFolder = `${folder}/${userIdentification}`;
    let filename = Date.now();

    if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
        const json_beautify = JSON.stringify(user, null, 4);
        fs.writeFile(`${userFolder}/info.json`, json_beautify, (err) => {
            if (err) {
                console.error('Error creating user info file', err);
            }
        });
    }
    if (fs.existsSync(filename)) {
        console.log('Media already exists:', media.filename);
        return;
    }

    filename = `${userFolder}/${filename}${extension}`;
    fs.writeFile(filename, dataBuffer, (err) => {
        if (!err) {
            console.log('Media saved as:', filename);
        }
    });
}

function saveMessageOnDb(msg) {

    const message = new Message({
        from: msg.from,
        to: msg.to,
        body: msg.body,
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


client.on('message', async msg => {
    if (msg.hasMedia) {
        let user = await msg.getContact();
        const media = await msg.downloadMedia();

        if (user === 'status@broadcast') {
            user = 'anonymous';
        }
        saveMedia(media, user);
    }
});

client.on('message_revoke_everyone', async (after, before) => {
    console.log('Message revoked');
    if (before) {
        before.body = `BEFORE: ${before.body}`
        console.log('Before message: ', before.body);
        saveMessageOnDb(before);
    }
    if (after) {
        after.body = `AFTER: ${after.body}`
        console.log('After message: ', after.body);
        saveMessageOnDb(after);
    }
});

let rejectCalls = true;
client.on('call', async (call) => {
    console.log('Call received, rejecting. GOTO Line 261 to disable', call);
    if (rejectCalls) await call.reject();
    await client.sendMessage(
        call.from,
        `[${call.fromMe ? 'Outgoing' : 'Incoming'}] Phone call from ${call.from}, type ${call.isGroup ? 'group' : ''} 
        ${call.isVideo ? 'video' : 'audio'} call. ${rejectCalls ? 'This call was automatically rejected by the script.' : ''}`
    );
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});
