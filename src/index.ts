import { Bot, GrammyError, HttpError, session } from "grammy";
import { Config } from "./utils";
import { BotContext, buildUserBot, buildAdminBot } from "./bot";

const config = new Config();

const bot = new Bot<BotContext>(config.token);

bot.api.setMyCommands([
  { command: "id", description: "Узнать свой ID" },
  { command: "start", description: "Начать работу бота" },
]);

bot.command("id", (ctx) => {
  if (!ctx.from?.id) return;
  ctx.reply(ctx.from.id.toString());
});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

bot.use(session({ initial: () => ({ createEvent: {}, createHomework: {} }) }));

buildAdminBot(bot, config);
buildUserBot(bot, config);

bot.start();
