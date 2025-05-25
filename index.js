import SnapBot from "./snapbot.js";
import dotenv from "dotenv";
dotenv.config();

const bot = new SnapBot();

let credentials = {
  username: process.env.USER_NAME,
  password: process.env.USER_PASSWORD,
};

async function sendSnap() {
  await bot.launchSnapchat({ headless: false }); // makes the browser visible
  await bot.login(credentials);
  await bot.captureSnap({ caption: "Hello world" });
  await bot.screenshot({ path: "screenshot.png" });
  await bot.send("BestFriends");
  await bot.wait(2000);
  await bot.closeBrowser();
}

sendSnap();
