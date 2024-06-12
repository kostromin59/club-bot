import { InlineKeyboard } from "grammy";
import { Commands, EventsAdminMenu } from "../../bot";
import { prisma } from "../prisma";

const pageSize = 5;

export const getEventsMessage = async (page = 1, isAdmin = false) => {
  const events = await prisma.event.findMany({
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: {
      dateStart: "desc",
    },
    where: {
      dateStart: !isAdmin
        ? {
            gte: new Date(),
          }
        : {},
    },
  });
  const eventsCount = await prisma.event.count({
    where: {
      dateStart: !isAdmin
        ? {
            gte: new Date(),
          }
        : {},
    },
  });
  const pagesCount = Math.ceil(eventsCount / pageSize);

  const eventsMessage = events.reduce((acc, event, index) => {
    acc += `<b>${event.name}</b> (#${index + 1})\n${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(event.dateStart)}\nМесто: ${event.place}\nМаксимальное кол-во участников: ${event.usersCount}\nМаксимальное кол-во платных участников: ${event.payersCount}\n\n`;
    return acc;
  }, "");

  const message = events.length
    ? `Список мероприятий (Кнопками выберите действие)\n\n${eventsMessage}Страница ${page} из ${pagesCount < 1 ? 1 : pagesCount}`
    : "Мероприятий нет!";
  const keyboard = (isAdmin ? EventsAdminMenu() : new InlineKeyboard()).row();

  // Кнопки управления
  if (isAdmin) {
    events.forEach((event, index) => {
      keyboard
        .text(`Управлять ${index + 1}`, `${Commands.EventsManage}:${event.id}`)
        .row();
    });
  } else {
    events.forEach((event, index) => {
      keyboard
        .text(
          `Записаться на #${index + 1}`,
          `${Commands.RegisterToEvent}:${event.id}`,
        )
        .row();
    });
  }

  if (page === 1 && pagesCount > 1) {
    keyboard.text("Следующая страница", `${Commands.EventsSetPage}:2`);
  } else if (page === pagesCount && page !== 1) {
    keyboard.text(
      "Предыдущая страница",
      `${Commands.EventsSetPage}:${page - 1}`,
    );
  } else if (pagesCount > 1) {
    keyboard.text("<", `${Commands.EventsSetPage}:${page - 1}`);
    keyboard.text("первая", `${Commands.EventsSetPage}:1`);
    keyboard.text("последняя", `${Commands.EventsSetPage}:${pagesCount}`);
    keyboard.text(">", `${Commands.EventsSetPage}:${page + 1}`);
  }

  return { message, keyboard };
};

export const getUserRegisteredEventsMessage = async (
  userId: number | bigint,
) => {
  const events = await prisma.userEvent.findMany({
    orderBy: {
      event: {
        dateStart: "desc",
      },
    },
    where: {
      userId: userId,
      event: {
        dateStart: {
          gte: new Date(),
        },
      },
    },
    include: {
      event: true,
    },
  });

  const keyboard = new InlineKeyboard();

  if (!events.length) {
    const message = "Вы ещё никуда не записаны!";
    return { message, keyboard };
  }

  const eventsMessage = events.reduce((acc, { event }, index) => {
    acc += `<b>${event.name}</b> (#${index + 1})\n${Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(event.dateStart)}\nМесто: ${event.place}\nМаксимальное кол-во участников: ${event.usersCount}\nМаксимальное кол-во платных участников: ${event.payersCount}\n\n`;
    return acc;
  }, "");

  const message = `Список мероприятий (Кнопками выберите действие)\n\n${eventsMessage}`;

  events.forEach((event, index) => {
    keyboard
      .text(
        `Отписаться от #${index + 1}`,
        `${Commands.DeleteRegistrationToEvent}:${event.eventId}`,
      )
      .row();
  });

  return { message, keyboard };
};
