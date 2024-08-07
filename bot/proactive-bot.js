const { ActivityHandler, TurnContext, CardFactory, AttachmentLayoutTypes } = require('botbuilder');

const fs = require('fs');
const DATA_FILE = 'data/conversations.data';

class ProactiveBot extends ActivityHandler {
  constructor(adapter) {
    super();

    this.conversationReferences = this.loadConversationsFromDisk();
    this.adapter = adapter;

    this.onConversationUpdate(async (context, next) => {
      this.addConversationReference(context.activity);

      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      for (let cnt = 0; cnt < membersAdded.length; cnt++) {
        if (membersAdded[cnt].id !== context.activity.recipient.id) {
          const welcomeMessage = 'Welcome to the Proactive Bot sample.  Navigate to http://localhost:3978/api/notify to proactively message everyone who has previously messaged this bot.';
          await context.sendActivity(welcomeMessage);
        }
      }

      // By calling next() you ensure that the next BotHandler is run.
      await next();
    });

    this.onMessage(async (context, next) => {
      this.addConversationReference(context.activity);

      const income = context.activity.text;
      if (income === '/address') {
        await context.sendActivity(`Chat address: ${turnContext.activity.channelId}`);
      } else {
        await context.sendActivity(`I heard you say ${income}`);
      }

      // Echo back what the user said
      await next();
    });
  }

  addConversationReference(activity) {
    const conversationReference = TurnContext.getConversationReference(activity);
    if (!this.conversationReferences.hasOwnProperty(conversationReference.conversation.id)) {
      this.conversationReferences[conversationReference.conversation.id] = conversationReference;
      console.log(`Added new conversation:`, conversationReference)
      this.saveConversationsOnDisk();
    }
  }

  saveConversationsOnDisk() {
    console.log('* Save conversations on disk ...')
    fs.writeFile(DATA_FILE, JSON.stringify(this.conversationReferences), (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log(" - File written successfully.");
      }
    });
  }

  loadConversationsFromDisk() {
    if (fs.existsSync(DATA_FILE)) {
      const dataText = fs.readFileSync(DATA_FILE, "utf8")
      const dataObj = JSON.parse(dataText);
      console.log('* Loaded conversations: ', dataObj);
      return dataObj;
    }
    console.log('* Init default conversations {}');
    return {};
  }

  createAdaptiveCard(body) {
    return CardFactory.adaptiveCard(
        {
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          "version": "1.0",
          "type": "AdaptiveCard",
          body
        }
    );
  }

  async send(conversationId, body) {
    if (!this.conversationReferences.hasOwnProperty(conversationId)) {
      throw `unknown conversation id: '${conversationId}'`
    }

    await this.adapter.continueConversationAsync(
        process.env.MicrosoftAppId,
        this.conversationReferences[conversationId],
        async context => {
          await context.sendActivity(
              {
                attachments: [
                  this.createAdaptiveCard(body)
                ],
                attachmentLayout: AttachmentLayoutTypes.Carousel
              })
        }
    );
  }
}

module.exports.ProactiveBot = ProactiveBot;
