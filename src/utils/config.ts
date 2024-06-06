import "dotenv/config";

export class Config {
  public readonly token: string;
  public readonly admins: number[];

  constructor() {
    const token = process.env.TOKEN;
    if (!token) throw new Error("Укажите TOKEN");

    const admins = process.env.ADMINS ?? "";
    if (!admins) console.warn("Админы не указаны");

    this.token = token;
    this.admins = admins
      .split(",")
      .map((admin) => admin.trim())
      .map(Number)
      .filter((admin) => !isNaN(admin));
  }
}
