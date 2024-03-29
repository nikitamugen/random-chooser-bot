/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

const __API__ = 'https://random-chooser-backend.herokuapp.com/api/v1';

const restify = require('restify');
const builder = require('botbuilder');
const botbuilder_azure = require("botbuilder-azure");

// Setup Restify Server
//
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});
server.use(restify.plugins.bodyParser());

const botName = "random-chooser-bot";

const spacesExpr = "[ ]*";
const botNameExpr = `([@]?${botName})?${spacesExpr}`;

const serviceInfExpr = `${spacesExpr}(<[^>]*>)*`;

// Create chat connector for communicating with the Bot Framework Service
//
const connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users
//
server.post('/api/messages', connector.listen());

const bot = new builder.UniversalBot(connector);

// Register in-memory storage
//
const inMemoryStorage = new builder.MemoryBotStorage();
bot.set('storage', inMemoryStorage);

// ---------------------------------

bot.dialog('/', [
	function (session) {
		const msg = `You said: "${session.message.text}". Sorry, but i dont understand ...`;
		session.send(msg);
	}
])

// show id of a chat
// just to use in other service with logic
//
bot.dialog('address', [
	function (session) {
		session.send("Chat address: " + JSON.stringify(session.message.address));
	}
])
.triggerAction({
    matches: new RegExp(`^${botNameExpr}id${serviceInfExpr}$`, 'i'),
    onSelectAction: (session, args, next) => {
        session.beginDialog(args.action, args);
    }
});

// ---------------------------------

// periodically sending requests
// to keep app alive
//
server.get('/ping', (req, res, next) => {
    res.send('pong');
    next();
});
const https = require("https");
setInterval(function() {
    https.get("https://random-chooser-bot.herokuapp.com/ping");
}, 240000); // every 4 minutes (240000)

// post custom messages to to chat
// req:
// - chatAddress - chat identifier.
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
server.post('/message', (req, res, next) => {
    console.log(req.body);
    sendCustomCard(
        req.body.address,
        req.body.title,
        req.body.subTitle,
        req.body.textLines,
        req.body.cardLines,
        req.body.buttons
    );
    res.send(200);
    next();
});

function sendCustomCard(address, title, subTitle, textLines, cardLines, buttons) {
    const message = new builder.Message().address(address);

    if (exists(textLines)) {
        message.text(textLines.join('\n'));
    }

    if (exists(title) || exists(subTitle) || exists(cardLines) || exists(buttons)) {
        bot.loadSession(address, (error, session) => {
            if (exists(error)) {
                message.text(error);
            } else {
                const card = new builder.HeroCard(session)
                                        .title(title)
                                        .subtitle(subTitle);

                if (exists(cardLines)) {
                    card.text(cardLines.join('\n'));
                }

                if (exists(buttons)) {
                    card.buttons(buttons.map(b => builder.CardAction.openUrl(session, b.url, b.text)));
                }
                message.addAttachment(card);
            }
            bot.send(message);
        });
    } else {
        bot.send(message);
    }
}

function exists(some) {
	return (some !== "" && some !== undefined && some !== null);
}