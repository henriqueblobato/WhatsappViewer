# WhatsappViewer

## Overview

This Node.js script, named "WhatsappViewer," serves as a handler for WhatsApp messages using the WhatsApp Web API. It employs various functionalities for message processing, media handling, database integration, and call management. The script facilitates interaction with WhatsApp Web through the `whatsapp-web.js` library and stores message data in MongoDB using `mongoose`. Below is a breakdown of its features and usage instructions:

## Features

- **Authentication**: Utilizes local authentication with `LocalAuth` and stores authentication data locally.
- **Database Integration**: Utilizes MongoDB via Mongoose for storing messages and media.
- **Message Handling**: Processes incoming messages, saves media attachments, and stores message data in the database.
- **Revoked Message Tracking**: Tracks revoked messages and saves the message details before and after revocation.
- **Call Handling**: Automatically rejects incoming calls and sends a message to the caller.

## Setup and Dependencies

- **whatsapp-web.js**: A library for interacting with WhatsApp Web.
- **mongoose**: An ORM for MongoDB, used for database operations.
- **qrcode-terminal**: Generates QR codes for authentication.
- **Node.js**: The runtime environment for executing the script.

## Usage

1. **Installation**: Install dependencies using `npm install whatsapp-web.js mongoose qrcode-terminal`.
2. **Database Setup**: Ensure MongoDB is running locally.
3. **Execution**: Run the script with `node your_script_name.js`.
4. **Authentication**: Scan the QR code with your WhatsApp mobile app to authenticate.
5. **Operation**: The script will handle incoming messages, media, revoked messages, and calls automatically.

## Additional Notes

- Ensure proper file permissions for media storage and authentication data.
- Customize message saving and media handling functions as per your requirements.
- Modify call handling behavior according to your preferences.

For detailed information and usage guidelines, refer to the [whatsapp-web.js documentation](https://docs.openwa.dev/).

