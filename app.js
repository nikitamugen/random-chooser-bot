/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

const __API__ = 'https://random-chooser-backend.herokuapp.com/api/v1';

const restify = require('restify');
const builder = require('botbuilder');
const botbuilder_azure = require("botbuilder-azure");
const EventSource = require("eventsource");
const axios = require('axios');

// Setup Restify Server
//
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
//
const connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

const bot = new builder.UniversalBot(connector);

// Register in-memory storage
//
const inMemoryStorage = new builder.MemoryBotStorage();
bot.set('storage', inMemoryStorage); 

// Register table storage
//
// const tableName = 'botdata';
// const azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
// const tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);
// bot.set('storage', tableStorage);

bot.dialog('/', [
	function (session) {
		session.endConversation(`You said: "${session.message.text}". Sorry, but i didn't understand ... Please type help for instructions.`);
	}
])

bot.dialog('setup', [
	function (session, args) {
		if (args && args.lists) {
			const listString = args.lists.map( (currentValue) => {return currentValue.name} ).join(', ');
			builder.Prompts.text(session, `List name is incorrect. Please type a correct name from list: ${listString}`);
		} else {
			session.send("Setup begin !");
			builder.Prompts.text(session, "Please tell me a valid *Variant List* name from app to listen:");
		}
	},
	function (session, results) {
		const listName = results.response.replace(/^(random-chooser-bot)?([ ]*)/, '');
		getVariantListArray().then(validListArray => {
			if (!isVariantListNameValid(listName, validListArray)) {
				session.replaceDialog('setup', { lists: validListArray });
			} else {
				const address = session.message.address;
				addSSEListener(listName, address);
				session.endDialog(`Setup for list name: ${listName}`);
				session.endConversation("Setup complete !");
			}
		})
	}
])
.endConversationAction(
    "endSetup", "Setup canceled !",
    {
        matches: /^(random-chooser-bot)?([ ]*)(cancel|goodbye)$/i,
        confirmPrompt: "This will cancel your order. Are you sure?"
    }
)
.triggerAction({
    matches: /^(random-chooser-bot)?([ ]*)setup$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        //
        session.beginDialog(args.action, args);
    }
});

bot.dialog('help', function (session) {
	const card = new builder.ReceiptCard(session)
        .title('Available commands:')
        .facts([
            builder.Fact.create(session, '( setup )', 'Setup listener for variant list'),
            builder.Fact.create(session, '( next )', 'Choose next variant'),
            builder.Fact.create(session, '( random )', 'Choose random variant'),
            builder.Fact.create(session, '( help )', 'This menu')
        ]);

    const address = session.message.address;
    say(address, '', card);
})
.triggerAction({
    matches: /^(random-chooser-bot)?([ ]*)help$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        //
        session.beginDialog(args.action, args);
    }
});

bot.dialog('next', function (session) {
	try {
		const address = session.message.address;
		postListOperationByAddress(address, "next");
	}
	catch (error) {
		say(address, "error");
	}
	finally {
		session.endConversation();
	}
})
.triggerAction({
    matches: /^(random-chooser-bot)?([ ]*)next$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        //
        session.beginDialog(args.action, args);
    }
});

bot.dialog('random', function (session) {
	try {
		const address = session.message.address;
		postListOperationByAddress(address, "randomNext");
	}
	catch (error) {
		say(address, "error");
	}
	finally {
		session.endConversation();
	}
})
.triggerAction({
    matches: /^(random-chooser-bot)?([ ]*)random$/i,
    onSelectAction: (session, args, next) => {
        // Add the help dialog to the dialog stack 
        // (override the default behavior of replacing the stack)
        //
        session.beginDialog(args.action, args);
    }
});

function postListOperationByAddress (address, operation) {
	try {
		const variantListName = _getListByAddress(address);
		const encodedVariantListName = encodeURIComponent(variantListName);

		const webMethod = `${__API__}/variantList/${operation}/${encodedVariantListName}`;
		return axios.post(webMethod)
		.catch(error => {
			say(address, error);
		});
	}
	catch (error) {
		say(address, "Sorry, but i don't know list to make operation under. Please make *setup* for begin.");
	}
}

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
	const webMethod = `${__API__}/variantList/`;
	return axios.get(webMethod)
	.then(response => {
		return response.data;
	});
}

function addSSEListener (variantListName, address) {
	if (isEmpty(variantListName)) {
		console.log("addSSEListener|variantListName is Empty");
		return;
	}
	if (isEmpty(address)) {
		console.log("addSSEListener|address is Empty");
		return;
	}
	_removeListEmiterByList(variantListName);
	_addListEmiterByList(variantListName, address);
}
function _removeListEmiterByList (variantListName) {
	if (knownListEmiterDict.hasOwnProperty(variantListName)) {
		eventSource = knownListEmiterDict[variantListName]
		eventSource.close();

		delete knownListEmiterDict[variantListName];
	}
	if (knownListAdressDict.hasOwnProperty(variantListName)) {
		delete knownListAdressDict[variantListName];
	}
}
function _removeListEmiterByAddress (address) {
	const variantListName = _getListByAddress(address);
	_removeListEmiterByList(variantListName);
}
function _addListEmiterByList (variantListName, address) {
	const encodedVariantListName = encodeURIComponent(variantListName);
	const webMethod = `${__API__}/events/${encodedVariantListName}/${address.channelId}`;
	eventSource = new EventSource(webMethod, {withCredentials: true});
	eventSource.onerror = sseEventErrorHandler;
	eventSource.onmessage = sseEventHandler;

	knownListEmiterDict[variantListName] = eventSource;
	knownListAdressDict[variantListName] = address;
}

function sseEventHandler (event) {
	const message = JSON.parse(event.data);
	const variantListName = message.listName;
	const address = getAdressByList(variantListName);

	if (message.type == "CONNECTED") {
		console.log(`CONNECTED with list: "${variantListName}"`);
	} else if (message.type == "VARIANT_LIST_REMOVE") {
		say(address, `Sorry, but variant list with name: "${variantListName}" was removed. Type *setup* to continue. Or remove me.`);
		eventSource.close();
	} else {
		say(address, message.text);
	}
}
function sseEventErrorHandler (event) {
	if (eventSource.readyState === 2) {
		console.log(`Listener fault". Try reconnect after 5 seconds`);
		setTimeout(addSSEListener, 5000);
	}
}

var knownListAdressDict = {};
var knownListEmiterDict = {};
function getAdressByList (variantListName) {
	if (knownListAdressDict.hasOwnProperty(variantListName)) {
		return knownListAdressDict[variantListName];
	}
	throw `List "${variantListName}" is unknown !`;
}
function _getListByAddress (address) {
	for (variantListName in knownListAdressDict) {
		const listAddress = knownListAdressDict[variantListName];
		if (listAddress.channelId === address.channelId) {
			return variantListName;
		}
	}
	throw `Address "${address}" is not registered !`;
}
function getEmiterByList (variantListName) {
	if (knownListEmiterDict.hasOwnProperty(variantListName)) {
		return knownListEmiterDict[variantListName];
	}
	throw `List "${variantListName}" is unknown !`;
}

const botAddedAction = "add";
const botRemovedAction = "remove";
bot.on('conversationUpdate', (event) => {
	const address = event.address;
	if (event.action === botAddedAction) {
		const msg = "Oh ... Hi there ! For begin type *help* for instructions. Or say *setup* to setup :)";
		say(address, msg);
	} else if (event.action === botRemovedAction) {
		const msg = "Goodbye ! :)";
		say(address, msg);

		_removeListEmiterByAddress(address);
	}	
});

function say (address, text, card) {
	let message = new builder.Message()
	 			   .address(address)
	 			   .text(text);
	if (!isEmpty(card)) {
		message.addAttachment(card);
	}

	bot.send(message);
}

function isEmpty (some) {
	return (some === "" || some === undefined || some === null);
}