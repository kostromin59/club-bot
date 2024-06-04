import { Bot, GrammyError, HttpError, session } from "grammy";
import { Config, RegistrationSteps, phoneMasks } from "./utils";
import { BotContext } from "./bot";
import { prisma } from "./utils/prisma";
import { SendPhoneMenu } from "./bot/menu";

const config = new Config();

const bot = new Bot<BotContext>(config.token);

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

bot.use(session({ initial: () => ({}) }));

bot.command("start", async (ctx) => {
  const id = ctx.from?.id;
  const nickname = ctx.from?.username;
  if (!id || !nickname) return;

  // TODO: Сделать проверку на админа
  const isAdmin = false;
  if (isAdmin) return;

  const user = await prisma.user.findFirst({
    where: {
      id,
    },
  });

  if (!user) {
    await prisma.user.create({
      data: {
        id,
        nickname,
      },
    });
    ctx.session.registrationStep = RegistrationSteps.FIO;
    await ctx.reply("Введите ФИО");
    return;
  }

  if (!user.fio) {
    ctx.session.registrationStep = RegistrationSteps.FIO;
    await ctx.reply("Введите ФИО");
    return;
  }

  if (!user.phone) {
    ctx.session.registrationStep = RegistrationSteps.PHONE;
    await ctx.reply("Введите номер телефона в формате +79123456789", {
      reply_markup: SendPhoneMenu,
    });
    return;
  }

  // TODO: Отправить меню
  await ctx.reply("Отправить меню");
});

bot.use(async (ctx, next) => {
  const user = await prisma.user.findFirst({
    where: {
      id: ctx.from?.id,
    },
  });

  if (!user) return;

  const step = ctx.session.registrationStep;

  if (!step) {
    if (!user.fio) {
      ctx.session.registrationStep = RegistrationSteps.FIO;
      await ctx.reply("Введите ФИО");
      return;
    }

    if (!user.phone) {
      ctx.session.registrationStep = RegistrationSteps.PHONE;
      await ctx.reply("Введите номер телефона в формате +79123456789", {
        reply_markup: SendPhoneMenu,
      });
      return;
    }

    return next();
  }

  const message = ctx.message;
  if (!message) return;

  const contact = message.contact?.phone_number;

  const phoneData = {
    phone: "",
  };

  switch (step) {
    case RegistrationSteps.FIO:
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          fio: message.text,
        },
      });

      ctx.session.registrationStep = RegistrationSteps.PHONE;
      await ctx.reply("Введите номер телефона в формате +79123456789", {
        reply_markup: SendPhoneMenu,
      });
      break;
    case RegistrationSteps.PHONE:
      if (user.phone) {
        ctx.session.registrationStep = undefined;
        break;
      }

      if (contact) {
        phoneData.phone = contact;
      } else {
        const text = message.text;
        if (!text) return;

        if (!phoneMasks.some((mask) => mask.test(text)))
          return await ctx.reply("Повторите попытку", {
            reply_markup: SendPhoneMenu,
          });

        phoneData.phone = text;
      }

      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: phoneData,
      });
      ctx.session.registrationStep = undefined;
      // TODO: Добавить меню
      await ctx.reply("Всё хорошо, тут будет меню");
      break;
  }
});

bot.on("message", (ctx) => ctx.react("🔥"));

bot.start();
