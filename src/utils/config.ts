import "dotenv/config";

export class Config {
  public readonly token: string;

  constructor() {
    const token = process.env.TOKEN;
    if (!token) throw new Error("Укажите TOKEN");

    this.token = token;
  }
}
