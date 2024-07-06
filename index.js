#!/usr/bin/env node

// ======================================================
// ENV
// ======================================================

// Import required packages
const path = require('path');

// Note: Ensure you have a .env file and include the MicrosoftAppId and MicrosoftAppPassword.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

// ======================================================

const restify = require('restify');
const builder = require('botbuilder');
const authentication = new builder.ConfigurationBotFrameworkAuthentication(process.env);
const adapter = new builder.CloudAdapter(authentication);

// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights. See https://aka.ms/bottelemetry for telemetry
    //       configuration instructions.
    console.error(`\n [onTurnError] unhandled error: ${ error }`);

    // Send a trace activity, which will be displayed in Bot Framework Emulator
    await context.sendTraceActivity(
        'OnTurnError Trace',
        `${ error }`,
        'https://www.botframework.com/schemas/error',
        'TurnError'
    );

    // Send a message to the user
    await context.sendActivity('The bot encountered an error or bug.');
    await context.sendActivity('To continue to run this bot, please fix the bot source code.');
};

// This bot's main dialog.
const { ProactiveBot } = require('./bot/proactive-bot');
const bot = new ProactiveBot(adapter);

// Setup Restify Server
//
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});
server.use(restify.plugins.bodyParser());

// Listen for messages from users
//
// Listen for incoming requests at /api/messages.
server.post('/api/messages', async (req, res) => {
    await adapter.process(req, res, (context) => bot.run(context));
});

// ---------------------------------

server.get('/ping', (req, res, next) => {
    res.send('pong');
    next();
});

// post custom messages to to chat
// req:
// - address - chat identifier.
//   Get address with "address" command in chat
// - title - title of a card with text lines and buttons
// - subTitle - optional subtitle
// - textLines - optional array ot text lines for primary message.
//   Like: ['one', 'two'] - is "one\ntwo"
// - buttons - array of clickable urls for card.
//   Like: [{'text': 'one', url: 'http://one'}, {'text': 'two', 'url': 'http://two'}]
//
// Example:
//    {
//      "address": "some chat adress ...",
//      "title": "Wow! Skype is not dead yeat?",
//      "subTitle": "Or its a bad joke?",
//      "textLines": [
//        "one",
//        "two"
//      ],
//      "buttons": [
//        {
//          "text": "one",
//          "url": "http://one"
//        }, {
//          "text": "two",
//          "url": "http://two"
//        }
//      ]
//    }
server.post('/message', async (req, res) => {
    console.log(req.body);
    try {
        await bot.send(
            req.body.address,
            req.body.card
        );
        res.send(200);
    } catch (e) {
        res.send(500, e);
    }
});
