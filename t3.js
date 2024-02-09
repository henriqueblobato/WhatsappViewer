const { Client, Location, Poll, List, Buttons, LocalAuth } = require("whatsapp-web.js");
const fs = require('fs');
const qrcode = require("qrcode-terminal");
const mongoose = require("mongoose");
const path = require('path');


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
    // check if media is a valid object
    if (!media) {
        console.error('Invalid media from user', user.number, 'with name', user.pushname || 'anonymous');
        return;
    }
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

    const folder = 'medias';
    const userIdentification = user.pushname || user.number;
    const userFolder = `${folder}/${userIdentification}`;
    const extensionFolder = `${userFolder}/${extension.substr(1)}`; // Remove the dot from extension

    // Create extension folder if it doesn't exist
    if (!fs.existsSync(extensionFolder)) {
        fs.mkdirSync(extensionFolder, { recursive: true });
    }

    const filename = `${Date.now()}${extension}`;
    const filePath = path.join(extensionFolder, filename);

    fs.writeFile(filePath, dataBuffer, err => {
        if (err) {
            console.error('Error saving media:', err);
        } else {
            console.log('Media saved as:', filePath);
        }
    });
}

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
    saveMessageOnDb(before, after);
    let from_user = await before.getContact();
    console.log('Message revoked from user', from_user.number, '\nMessage:', before.body, 'After:', after.body);
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
