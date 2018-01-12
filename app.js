/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

const __API__ = 'https://random-chooser-backend.herokuapp.com/api/v1/';

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var EventSource = require("eventsource");
const axios = require('axios');

// Setup Restify Server
//
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
//
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

var bot = new builder.UniversalBot(connector);

// Register in-memory storage
//
// var inMemoryStorage = new builder.MemoryBotStorage();
// bot.set('storage', inMemoryStorage); 

// Register table storage
//
var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);
bot.set('storage', tableStorage);

var variantListName;
bot.dialog('setup', [
	function (session, args) {
		session.send("Setup begin !");
		messageAddress = session.message.address;

		if (args && args.lists) {
			const listString = args.lists.map( (currentValue) => {return currentValue.name} ).join(', ');
			builder.Prompts.text(session, `List name is incorrect. Please type a correct name from list: ${listString}`);
		} else {
			builder.Prompts.text(session, "Please tell me a valid *Variant List* name from app to listen:");
		}
	},
	function (session, results) {
		const listName = results.response;
		getVariantListArray().then(validListArray => {
			if (!isVariantListNameValid(listName, validListArray)) {
				session.replaceDialog('setup', { lists: validListArray });
			} else {
				variantListName = encodeURIComponent(listName);
				addSSEListener();
				session.endDialog(`Setup for list name: ${listName}`);
				session.endConversation("Setup complete !");
			}
		})
	}
])
.endConversationAction(
    "endSetup", "Setup canceled !",
    {
        matches: /^cancel$|^goodbye$/i,
        confirmPrompt: "This will cancel your order. Are you sure?"
    }
)
.triggerAction({
    matches: /^setup$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        //
        session.beginDialog(args.action, args);
    }
});

bot.dialog('help', function (session) {
	messageAddress = session.message.address;

	const card = new builder.ReceiptCard(session)
        .title('Available commands:')
        .facts([
            builder.Fact.create(session, '( setup )', 'Setup listener for variant list'),
            builder.Fact.create(session, '( next )', 'Choose next variant'),
            builder.Fact.create(session, '( random )', 'Choose random variant'),
            builder.Fact.create(session, '( help )', 'This menu')
        ]);
    say('',card);
})
.triggerAction({
    matches: /^help$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        //
        session.beginDialog(args.action, args);
    }
});

bot.dialog('next', function (session) {
	messageAddress = session.message.address;

	try {
		getNext();
	}
	finally {
		session.endConversation();
	}
})
.triggerAction({
    matches: /^next$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        //
        session.beginDialog(args.action, args);
    }
});

bot.dialog('random', function (session) {
	messageAddress = session.message.address;

	try {
		getRandom();
	}
	finally {
		session.endConversation();
	}
})
.triggerAction({
    matches: /^random$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        //
        session.beginDialog(args.action, args);
    }
});

bot.dialog('askVariantListName', [
	function (session) {
        builder.Prompts.text(session, "Please tell me a valid *Variant List* name from app to listen");
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]);

function isVariantListNameValid (variantListName, variantListArray) {
	if (variantListName === "" || variantListName === undefined || variantListName === null) {
		return false;
	}
	return variantListArray.some((currentValue, index, array) => {
		return (currentValue.name === variantListName);
	});
}

function getVariantListArray () {
	const webMethod = __API__+'variantList/';
	return axios.get(webMethod)
	.then(response => {
		return response.data;
	})
	.catch(error => {
		say(`Error: ${error}`);
	});
}
function getNext () {
	checkVariantListNameEmpty();

	const webMethod = __API__+'variantList/next/'+variantListName;
	return axios.post(webMethod)
	.catch(error => {
		say(error);
	});
}
function getRandom () {
	checkVariantListNameEmpty();

	const webMethod = __API__+'variantList/randomNext/'+variantListName;
	return axios.post(webMethod)
	.catch(error => {
		say(error);
	});
}

function checkVariantListNameEmpty() {
	if (variantListName === "" || variantListName === undefined || variantListName === null) {
		say("Sorry, but *Variant list name* is empty. Please make *setup* for begin.");
		throw "variantListName is empty !";
	}
}

var eventSource;
function addSSEListener () {
	if (eventSource !== undefined) {
		eventSource.close();
	}
	const webMethod = __API__+'events/'+variantListName+'/'+sessionGuid;
	eventSource = new EventSource(webMethod, {withCredentials: true});
	eventSource.onerror = sseEventErrorHandler;
	eventSource.onmessage = sseEventHandler;
}
function sseEventHandler (event) {
	const message = JSON.parse(event.data);
	if (message.type == "CONNECTED") {
		console.log('CONNECTED');
	} else if (message.type == "VARIANT_LIST_REMOVE") {
		say(`Sorry, but variant list with name '${message.listName}' was removed. Type *setup* to continue. Or remove me.`);
		eventSource.close();
	} else {
		say(message.text);
	}
}
function sseEventErrorHandler (event) {
	if (eventSource.readyState === 2) {
		console.log('SSE listener fault. Try reconnect after 5 seconds');
		setTimeout(addSSEListener, 5000);
	}
}

var messageAddress;
bot.on('contactRelationUpdate', (message) => {
	messageAddress = message.address;
});
bot.on('conversationUpdate', (message) => {
	messageAddress = message.address;
});
function say (text, card) {
	let message = new builder.Message()
	 			   .address(messageAddress)
	 			   .text(text);
	if (card !== undefined || card !== null) {
		message.addAttachment(card);
	}

	bot.send(message);
}

const sessionGuid = (() => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
})();
