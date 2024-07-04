const { ActivityHandler, TurnContext } = require('botbuilder');

class ProactiveBot extends ActivityHandler {
  constructor(conversationReferences, adapter) {
    super();

    this.conversationReferences = conversationReferences;
    this.adapter = adapter;
    console.log(conversationReferences);

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
    this.conversationReferences[conversationReference.conversation.id] = conversationReference;
  }

  async send(conversationId, title, subTitle, textLines, cardLines, buttons) {
    if (!this.conversationReferences.hasOwnProperty(conversationId)) {
      throw `unknown conversation id: '${conversationId}'`
    }

    await this.adapter.continueConversationAsync(
        process.env.MicrosoftAppId,
        this.conversationReferences[conversationId],
        async context => {
          await context.sendActivity(title);
        }
    );
  }
}

module.exports.ProactiveBot = ProactiveBot;
