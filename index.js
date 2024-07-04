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

// This bot's main dialog.
const { ProactiveBot } = require('./bot/proactive-bot');
const conversationReferences = {};
const bot = new ProactiveBot(conversationReferences, adapter);

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
// - cardLines - optional array ot text lines for card message.
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
//      "cardLines": [
//        "three",
//        "four"
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
            req.body.title,
            req.body.subTitle,
            req.body.textLines,
            req.body.cardLines,
            req.body.buttons
        );
        res.send(200);
    } catch (e) {
        res.send(500, e);
    }
});
