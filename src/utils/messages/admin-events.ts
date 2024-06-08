import { Commands, EventsAdminMenu } from "../../bot";
import { prisma } from "../prisma";

export const getAdminEventsMessage = async (page: number = 1) => {
  const pageSize = 2;

  const events = await prisma.event.findMany({
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: {
      dateStart: "desc",
    },
  });
  const eventsCount = await prisma.event.count();
  const pagesCount = Math.ceil(eventsCount / pageSize);

  const eventsMessage = events.reduce((acc, event) => {
    acc += `<b>${event.name}</b> (id: ${event.id})\n${new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(event.dateStart)}\nМесто: ${event.place}\nКол-во участников: ${event.usersCount}\n\n`;
    return acc;
  }, "");

  const message = `Список мероприятий\n\n${eventsMessage}Страница ${page} из ${pagesCount < 1 ? 1 : pagesCount}`;
  const keyboard = EventsAdminMenu().row();
  events.forEach((event) => {
    keyboard
      .text(`Управлять ${event.id}`, `${Commands.EventsManage}:${event.id}`)
      .row();
  });

  if (page === 1 && pagesCount >= 2) {
    keyboard.text("Следующая страница", `${Commands.EventsSetPage}:2`);
  } else if (page === pagesCount && page !== 1) {
    keyboard.text(
      "Предыдущая страница",
      `${Commands.EventsSetPage}:${page - 1}`,
    );
  } else {
    keyboard.text("<", `${Commands.EventsSetPage}:${page - 1}`);
    keyboard.text("первая", `${Commands.EventsSetPage}:1`);
    keyboard.text(">", `${Commands.EventsSetPage}:${page + 1}`);
  }

  return { message, keyboard };
};
