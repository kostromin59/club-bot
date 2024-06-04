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

// TODO: Сделать проверку на админа
const adminBot = bot.filter(() => {
  const isAdmin = false;
  return isAdmin;
});

adminBot.command("start", async (ctx) => {
  ctx.reply("Admin");
});

// TODO: Сделать проверку на НЕ админа
const userBot = bot.filter(() => {
  const isUser = true;
  return isUser;
});

// Установка пользователя в сессию
userBot.use(async (ctx, next) => {
  const id = ctx.from?.id;
  const nickname = ctx.from?.username;
  if (!id || !nickname) return;

  const user = await prisma.user.findFirst({ where: { id } });

  if (!user) {
    const user = await prisma.user.create({
      data: {
        id,
        nickname,
      },
    });

    ctx.session.user = user;
  } else {
    ctx.session.user = user;
  }

  next();
});

// Регистрация пользователя (обработка шагов)
userBot.use(async (ctx, next) => {
  const user = ctx.session.user;
  if (!user) return;

  const step = ctx.session.registrationStep;
  if (!step) return next();

  const message = ctx.message;
  if (!message) return;

  const contact = message.contact?.phone_number;

  const phoneData = {
    phone: "",
  };

  switch (step) {
    case RegistrationSteps.FIO:
      ctx.session.user = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          fio: message.text,
        },
      });

      if (ctx.session.user.phone) return next();

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
          return await ctx.reply(
            "Вы некорректно ввели телефон. Попробуйте ещё раз!",
            {
              reply_markup: SendPhoneMenu,
            },
          );

        phoneData.phone = text;
      }

      ctx.session.user = await prisma.user.update({
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

// Валидация пользователя
userBot.use(async (ctx, next) => {
  const user = ctx.session.user;
  if (!user) return;

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
});

userBot.command("start", async (ctx) => {
  // TODO: Отправить меню
  await ctx.reply("Отправить меню");
});

userBot.on("message", (ctx) => ctx.react("🔥"));

bot.start();
