import { Bot, GrammyError, HttpError, session } from "grammy";
import {
  Config,
  CreateEventSteps,
  RegistrationSteps,
  isValidPhoneNumber,
} from "./utils";
import {
  AdminMenu,
  BotContext,
  Commands,
  EventsAdminMenu,
  SendPhoneMenu,
} from "./bot";
import { prisma } from "./utils/prisma";

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

bot.use(session({ initial: () => ({ createEvent: {} }) }));

const adminBot = bot.filter((ctx) => {
  const id = ctx.from?.id;
  if (!id) return false;

  const isAdmin = config.admins.includes(id);
  return isAdmin;
});

adminBot.command("start", (ctx) => {
  ctx.reply("Добро пожаловать!", {
    reply_markup: AdminMenu,
  });
});

adminBot.hears(Commands.Events, async (ctx) => {
  const events = await prisma.event.findMany();
  console.log(events);
  await ctx.reply("Тут будет список мероприятий", {
    reply_markup: EventsAdminMenu,
  });
});

adminBot.callbackQuery(Commands.CreateEvent, async (ctx) => {
  ctx.session.createEvent.step = CreateEventSteps.Name;
  await ctx.answerCallbackQuery("Начало создания мероприятия");
  await ctx.reply("Введите название мероприятия");
});

adminBot.use(async (ctx, next) => {
  const step = ctx.session.createEvent.step;
  if (!step) return next();

  const message = ctx.message?.text;
  if (!message) return;

  switch (step) {
    case CreateEventSteps.Name:
      ctx.session.createEvent.data = {
        name: message,
        place: "",
        dateStart: "",
      };

      ctx.session.createEvent.step = CreateEventSteps.UsersCount;
      await ctx.reply("Введите количество участников");
      return;
    case CreateEventSteps.UsersCount:
      ctx.session.createEvent.data!.usersCount = Number.parseInt(message);

      ctx.session.createEvent.step = CreateEventSteps.DateStart;
      await ctx.reply("Введите дату начала");
      return;
    case CreateEventSteps.DateStart:
      ctx.session.createEvent.data!.dateStart = message;

      ctx.session.createEvent.step = CreateEventSteps.Place;
      await ctx.reply("Введите место проведения");
      return;
    case CreateEventSteps.Place:
      ctx.session.createEvent.data!.place = message;

      await prisma.event.create({
        data: ctx.session.createEvent.data!,
      });

      ctx.session.createEvent = {};

      await ctx.reply("Мероприятие создано!");
      return;
  }
});

const userBot = bot.filter((ctx) => {
  const id = ctx.from?.id;
  if (!id) return false;

  const isUser = !config.admins.includes(id);
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
    phone: contact,
  };

  switch (step) {
    case RegistrationSteps.Fio:
      ctx.session.user = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          fio: message.text,
        },
      });

      if (ctx.session.user.phone) return next();

      ctx.session.registrationStep = RegistrationSteps.Phone;
      await ctx.reply("Введите номер телефона в формате +79123456789", {
        reply_markup: SendPhoneMenu,
      });

      break;
    case RegistrationSteps.Phone:
      if (user.phone) {
        ctx.session.registrationStep = undefined;
        break;
      }

      if (!contact) {
        if (!isValidPhoneNumber(message.text))
          return await ctx.reply(
            "Вы некорректно ввели телефон. Попробуйте ещё раз!",
            {
              reply_markup: SendPhoneMenu,
            },
          );

        phoneData.phone = message.text!;
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
    ctx.session.registrationStep = RegistrationSteps.Fio;
    await ctx.reply("Введите ФИО");
    return;
  }

  if (!user.phone) {
    ctx.session.registrationStep = RegistrationSteps.Phone;
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
