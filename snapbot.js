import puppeteer from "puppeteer-extra";
import Stealth from "puppeteer-extra-plugin-stealth";

puppeteer.use(Stealth());

import fs from "fs";
import fsPromise from "fs/promises";

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

const lastTestedVersion = "v13.38.0";

export default class SnapBot {
  constructor() {
    this.page = null;
    this.browser = null;
  }
  async launchSnapchat(obj, cookiefile) {
    try {
      const options = {
        ...obj,
        // executablePath: "/usr/bin/google-chrome",  // for docker
      };
      this.browser = await puppeteer.launch(options);

      if (cookiefile) {
        try {
          const cookiesString = fs.readFileSync(
            `./${cookiefile}-cookies.json`,
            "utf-8"
          );
          const cookies = JSON.parse(cookiesString);
          await this.browser.setCookie(...cookies);
          console.log("Cookies set");
        } catch (error) {
          console.error("Error in using cookies", error);
        }
      }

      const context = this.browser.defaultBrowserContext();

      await context.overridePermissions("https://web.snapchat.com", [
        "camera",
        "microphone",
      ]);

      this.page = await context.newPage();

      await this.page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      );

      //gets the version
      this.page.on("console", (msg) => {
        if (msg.type() === "log") {
          const text = msg.text();
          if (text.includes("Snapchat")) {
            console.log("Snapchat for Web Build info:", text);
            const version = text.match(/v\d+\.\d+\.\d+/);
            const currentVersion = version[0];
            console.log("Version", currentVersion);
            //check version
            if (currentVersion != lastTestedVersion) {
              console.warn(
                `⚠️  Warning: Some methods were last tested on version ${lastTestedVersion} \n\n` +
                  `Detected current version is ${currentVersion}\n\n` +
                  `Some features might not work properly.\n` +
                  `If you encounter issues, please try updating the project using 'git pull'.\n` +
                  `If the problem persists, consider raising an issue or contacting the developer.`
              );
            }
          }
        }
      });

      await this.page.goto("https://www.snapchat.com/?original_referrer=none");
    } catch (error) {
      console.error(`Error while Starting Snapchat : ${error}`);
    }
  }

  async login(credentials) {
    const { username, password } = credentials;
    if (username == "" || password == "") {
      throw new Error("Credentials cannot be empty");
    }
    try {
      // Enter username
      const defaultLoginBtn = await this.page.$("#ai_input");
      const loginBtn = await this.page.$('input[name="accountIdentifier"]');

      if (loginBtn) {
        this.page.waitForNetworkIdle();
        console.log("Entering username...");
        await this.page.type('input[name="accountIdentifier"]', username, {
          delay: 100,
        });
      }
      if (defaultLoginBtn) {
        console.log("Entering username...");
        await this.page.type("#ai_input", username, { delay: 100 });
      }

      await this.page.click("button[type='submit']");
    } catch (e) {
      console.log("Username field error:", e);
    }
    try {
      //Enter Password
      console.log("Waiting for password field...");
      await this.page.waitForSelector("#password", {
        visible: true,
        timeout: 60000,
      });
      await this.page.type("#password", password, { delay: 100 });
      console.log("Password field filled.");
    } catch (e) {
      console.log("Password field loading error:", e);
    }

    await this.page.click("button[type='submit']");
    await delay(10000);
    //click not now
    try {
      const notNowBtn = "button.NRgbw.eKaL7.Bnaur"; //NRgbw eKaL7 Bnaur
      console.log("Checking for 'Not now' button...");
      await this.page.waitForSelector(notNowBtn, {
        visible: true,
        timeout: 5000,
      });
      await this.page.click(notNowBtn);
      console.log("Clicked 'Not now' button.");
    } catch (e) {
      console.log("Popup handling error or popup not found:", e);
    }
    await delay(1000);
  }

  async isLogged() {
    const defaultLoginBtn = await this.page.$("#ai_input");
    const loginBtn = await this.page.$('input[name="accountIdentifier"]');

    if (defaultLoginBtn || loginBtn) {
      return false;
    }
    return true;
  }

  async handlePopup() {
    try {
      const notNowBtn = "button.NRgbw.eKaL7.Bnaur"; //NRgbw eKaL7 Bnaur
      const notNowBtnHandle = await this.page.waitForSelector(notNowBtn, {
        visible: true,
        timeout: 5000,
      });
      console.log("Checking for 'Not now' button...");
      if (notNowBtnHandle) {
        await this.page.waitForSelector(notNowBtn, {
          visible: true,
          timeout: 5000,
        });
        await this.page.click(notNowBtn);
        console.log("Clicked 'Not now' button.");
      } else {
        console.log("not found");
      }
    } catch (error) {
      console.log(`could not find Popup`);
    }
  }

  async captureSnap(obj) {
    try {
      //updated version here v2.0
      let captureBtnFound = false;
      const captureButtonSelector = "button.FBYjn.gK0xL.A7Cr_.m3ODJ";

      const captureButton = await this.page.$(captureButtonSelector);
      if (captureButton) {
        const isVisible = (await captureButton.boundingBox()) !== null;
        if (isVisible) {
          await captureButton.click();
          captureBtnFound = true;
        }
      }
      if (!captureBtnFound) {
        const svgButtonSelector = "button.qJKfS";
        await delay(1000);

        let isSVGbuttonFound = null;
        let retries = 0;
        const maxRetries = 3;

        while (!isSVGbuttonFound && retries < maxRetries) {
          try {
            isSVGbuttonFound = await this.page.waitForSelector(
              svgButtonSelector,
              {
                visible: true,
                timeout: 15000,
              }
            );
          } catch (error) {
            console.log("Couldn't find the SVG selector, retrying...");
          }

          if (!isSVGbuttonFound) {
            retries++;
            console.log(`Retries left: ${maxRetries - retries}`);
            await delay(1000);
          }
        }

        if (isSVGbuttonFound) {
          await this.page.click(svgButtonSelector);
          console.log("clicked svg button");
        } else {
          console.log("SVG button not found after maximum retries.");
        }
        // Capture button
        if (isSVGbuttonFound) {
          await delay(1000);
          const captureButtonSelector = "button.FBYjn.gK0xL.A7Cr_.m3ODJ"; //FBYjn gK0xL A7Cr_ m3ODJ
          const captureButton = await this.page.waitForSelector(
            captureButtonSelector,
            { visible: true }
          );
          await captureButton.click();
          console.log("✅ Clicked the capture button");
        }
      }

      await delay(3000);

      // 📸 Add custom image if `obj.path` exists
      if (obj.path) {
        try {
          const imageToBase64 = await fsPromise.readFile(obj.path, "base64");
          const imageData = `data:image/png;base64,${imageToBase64}`;

          // Wait for container
          const containerSelector = "#snap-preview-container";
          await this.page.waitForSelector(containerSelector, { visible: true });

          await this.page.evaluate(
            (containerSelector, imageData) => {
              const container = document.querySelector(containerSelector);
              if (container) {
                const img = container.querySelector("img");
                if (img) img.src = imageData;
              }
            },
            containerSelector,
            imageData
          );
          // await this.page.evaluate((imageData) => {
          //   const img = document.querySelector("#snap-preview-container img");
          //   if (img) img.src = imageData; // if imageData is already available in the page
          // }, imageData);

          console.log("✅ Image added successfully");
        } catch (error) {
          console.warn("⚠️ Error adding image:", error);
        }
      }

      await delay(1000);

      // 📝 Add caption if provided
      if (obj.caption) {
        await delay(2000);
        const captionButtonSelector = 'button[title="Add a caption"]';
        await this.page.waitForSelector(captionButtonSelector, {
          visible: true,
        });
        await this.page.click(captionButtonSelector);

        await delay(1000);
        const textareaSelector = 'textarea.B9QiX[aria-label="Caption Input"]';
        await this.page.waitForSelector(textareaSelector, { visible: true });
        await this.page.type(textareaSelector, obj.caption, { delay: 100 });

        console.log("✅ Caption added successfully");

        await delay(1000);

        //caption pos
        if (obj.position) {
          const elementHandle = await this.page.$(textareaSelector);
          if (elementHandle) {
            const box = await elementHandle.boundingBox();
            if (box) {
              const startX = box.x + box.width / 2;
              const startY = box.y + box.height / 2;
              const endY = startY + obj.position;

              await this.page.mouse.move(startX, startY); // Move to starting position
              await this.page.mouse.down(); // Click and hold (start drag)
              await this.page.mouse.move(startX, endY, { steps: 10 }); // Drag smoothly
              await this.page.mouse.up(); // Release (drop)
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Error in capturing the snap:", error);
    }
  }

  async send(person) {
    try {
      const button = await this.page.$("button.YatIx.fGS78.eKaL7.Bnaur"); //updated this

      if (button) {
        console.log("Button found!");
        await button.click();
      } else {
        console.log("Button not found.");
      }
      await delay(1000);
      let selected = "";
      person = person.toLowerCase();
      if (person == "bestfriends") {
        selected = "ul.UxcmY li  div.Ewflr.cDeBk.A8BRr ";
      } else if (person == "groups") {
        selected = "li div.RbA83";
      } else if (person == "friends") {
        selected = "li div.Ewflr";
      } else if (person == "all") {
        console.log("not implemented yet");
      } else {
        throw new Error("Option not found");
      }
      const accounts = await this.page.$$(selected);
      for (const account of accounts) {
        const isFriendVisible = await account.evaluate(
          (el) => el.offsetWidth > 0 && el.offsetHeight > 0
        ); // Check if the div is visible
        if (isFriendVisible) {
          await account.click(); // Click on the div element
        } else {
          console.log("account not found.");
        }
      }
      const sendButton = await this.page.$("button[type='submit']"); //YatIx q5eEJ eKaL7 Bnaur
      await sendButton.click();
      delay(5000);
    } catch (error) {
      console.error("Error while sending snap", error);
    }
  }

  async closeBrowser() {
    await delay(5000);
    await this.browser.close();
    console.log("Snapchat closed");
  }

  async screenshot(obj) {
    await this.page.screenshot(obj);
  }

  async logout() {
    await this.page.waitForSelector("#downshift-1-toggle-button");
    await this.page.click("#downshift-1-toggle-button");
    await this.page.click("#downshift-1-item-9");
    console.log("Logged Out");
    await delay(12000);
  }

  async wait(time) {
    return new Promise(function (resolve) {
      setTimeout(resolve, time);
    });
  }
  //beta
  async openFriendRequests() {
    await this.page.waitForSelector('button[title="View friend requests"]');
    const requests = await this.page.$('button[title="View friend requests"]');
    await requests.click();
  }

  async listRecipients() {
    await this.page.waitForSelector(
      "div.ReactVirtualized__Grid__innerScrollContainer"
    );
    const lists = await this.page.$$("div[role='listitem']");
    const data = [];

    for (const listItem of lists) {
      const titleSpan = await listItem.$("span[id^='title-']");
      if (titleSpan) {
        let id = await this.page.evaluate((el) => el.id, titleSpan);
        const name = await this.page.evaluate(
          (el) => el.textContent.trim(),
          titleSpan
        );
        id = id.replace(/^title-/, "");
        data.push({ id, name });
      }

      //status
    }

    // console.log(data);
    return data;
  }

  async sendMessage(obj) {
    await this.page.waitForSelector(
      "div.ReactVirtualized__Grid__innerScrollContainer"
    );
    const lists = await this.page.$$("div[role='listitem']");

    for (const listItem of lists) {
      const titleSpan = await listItem.$("span[id^='title-']");
      if (titleSpan) {
        const id = await this.page.evaluate((el) => el.id, titleSpan);
        let chatID = "title-" + obj.chat;
        if (id === chatID) {
          if (!obj.alreadyOpen) {
            await titleSpan.click();
          }

          if (obj.message === "") {
            // const cleanedID = obj.chat.replace(/^title-/, "");
            // return this.extractChatData(cleanedID);
          }

          // if its an array
          if (Array.isArray(obj.message)) {
            for (let msg of obj.message) {
              await this.page.waitForSelector('div[role="textbox"].euyIb');
              await this.page.type('div[role="textbox"].euyIb', `${msg}`);
              await this.page.keyboard.press("Enter");
            }
          }
          //if string
          if (typeof obj.message == "string") {
            await this.page.waitForSelector('div[role="textbox"].euyIb');
            await this.page.type('div[role="textbox"].euyIb', obj.message, {
              delay: 200,
            });
            await this.page.keyboard.press("Enter");
          }

          if (obj.exit) {
            // await delay(300);
            await titleSpan.click(); // go back
          }
        }
      }
    }
  }

  async saveCookies(username) {
    try {
      const cookies = await this.browser.cookies();
      fs.writeFileSync(
        `./${username}-cookies.json`,
        JSON.stringify(cookies, null, 2)
      );
      console.log("cookies saved for : ", username);
    } catch (error) {
      console.error("Error in saving cookies", error);
    }
  }

  async useCookies(username) {
    try {
      const cookiesString = fs.readFileSync(`./${username}-cookies.json`);
      const cookies = JSON.parse(cookiesString);
      await this.browser.setCookie(...cookies);
    } catch (error) {
      console.error("Error in using cookies", error);
    }
  }

  async extractChatData(userId) {
    return await this.page.evaluate((userId) => {
      const output = [];
      const $chatList = document.querySelector(`#cv-${userId}`);
      if (!$chatList) return [];

      const listItems = $chatList.querySelectorAll("li.T1yt2");

      let currentTime = null;
      let currentConvo = { time: "", conversation: [] };

      listItems.forEach((li) => {
        const timeElem = li.querySelector("time span");
        if (timeElem) {
          if (currentTime) output.push({ ...currentConvo });
          currentTime = timeElem.textContent.trim();
          currentConvo = { time: currentTime, conversation: [] };
          return;
        }

        const messageBlocks = li.querySelectorAll("li");

        if (messageBlocks.length > 0) {
          messageBlocks.forEach((block) => {
            let sender =
              block.querySelector("header .nonIntl")?.textContent.trim() || "";

            if (!sender) {
              const borderElem = block.querySelector(".KB4Aq");
              if (borderElem) {
                const color = getComputedStyle(borderElem).borderColor;
                if (color === "rgb(242, 60, 87)") sender = "Me";
                else if (color === "rgb(14, 173, 255)") sender = "Eren Yeager";
                else sender = "Unknown";
              }
            }

            const texts = Array.from(block.querySelectorAll("span.ogn1z")).map(
              (span) => span.textContent.trim()
            );

            texts.forEach((text) => {
              if (text) currentConvo.conversation.push({ from: sender, text });
            });
          });
        } else {
          const borderElem = li.querySelector(".KB4Aq");
          let sender = "Unknown";

          if (borderElem) {
            const color = getComputedStyle(borderElem).borderColor;
            sender = color === "rgb(242, 60, 87)" ? "Me" : "Unknown";
          }

          const text = li.querySelector("span.ogn1z")?.textContent.trim();
          if (text) currentConvo.conversation.push({ from: sender, text });
        }
      });

      if (currentConvo.conversation.length > 0) {
        output.push(currentConvo);
      }

      return output;
    }, userId);
  }

  async userStatus() {
    await this.page.waitForSelector(
      "div.ReactVirtualized__Grid__innerScrollContainer"
    );
    const lists = await this.page.$$("div[role='listitem']");
    const data = [];

    for (const listItem of lists) {
      const titleSpan = await listItem.$("span[id^='title-']");
      if (titleSpan) {
        const id = await this.page.evaluate((el) => el.id, titleSpan);
        const name = await this.page.evaluate(
          (el) => el.textContent.trim(),
          titleSpan
        );

        // Get the status span container using the ID
        const cleanedID = id.replace(/^title-/, "");
        const statusContainer = await listItem.$(`#status-${cleanedID}`);
        const statusParent = statusContainer
          ? await this.page.evaluateHandle(
              (el) => el.parentElement,
              statusContainer
            )
          : null;
        let status = [];

        if (statusParent) {
          const statusSpans = await statusParent.$$("span");
          status = await Promise.all(
            statusSpans.map((span) =>
              this.page.evaluate((el) => el.textContent.trim(), span)
            )
          );
        }
        let cleanedStatus = [
          ...new Set(
            status
              .map((text) => text?.trim())
              .filter((text) => text && text !== "·")
          ),
        ];

        let structuredStatus = {
          type: cleanedStatus[0] || null,
          time: cleanedStatus[1] || null,
          streak: cleanedStatus[2] || null,
        };

        data.push({ id: cleanedID, name, status: structuredStatus });
      }
    }
    return data;
  }

  async blockTypingNotifications(shouldBlock) {
    const client = await this.page.createCDPSession();

    await client.send("Fetch.enable", {
      patterns: [
        {
          urlPattern: "*SendTypingNotification*",
          requestStage: "Request",
        },
      ],
    });

    client.on("Fetch.requestPaused", async (event) => {
      const url = event.request.url;

      if (
        shouldBlock &&
        url.includes(
          "https://web.snapchat.com/messagingcoreservice.MessagingCoreService/SendTypingNotification"
        )
      ) {
        // console.log("[CDPBlock] Aborting request:", url);
        await client.send("Fetch.failRequest", {
          requestId: event.requestId,
          errorReason: "Failed",
        });
      } else {
        await client.send("Fetch.continueRequest", {
          requestId: event.requestId,
        });
      }
    });
  }

  //select
  async useShortcut(shortcutsArray) {
    const button = await this.page.$("button.YatIx.fGS78.eKaL7.Bnaur");
    if (button) {
      console.log("Send Button found!");
      await button.click();
    } else {
      console.log("Send Button not found.");
    }
    await delay(2000);
    for (const emoji of shortcutsArray) {
      const clicked = await this.page.$$eval(
        "div.THeKv button",
        (buttons, emoji) => {
          const btn = buttons.find((b) => b.textContent.trim() === emoji);
          if (btn) {
            btn.click();
            //now press the select
            return true;
          }
          return false;
        },
        emoji
      );

      if (clicked) {
        await this.page.waitForSelector("button.Y7u8A");
        await this.page.click("button.Y7u8A");
        const reclick = await this.page.$$eval(
          "div.THeKv button",
          (buttons, emoji) => {
            const btn = buttons.find((b) => b.textContent.trim() === emoji);
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          },
          emoji
        );
      }
      if (!clicked) {
        console.warn(`Shortcut "${emoji}" not found.`);
      }
    }
    //send button

    const sendButton = await this.page.$("button[type='submit']"); //YatIx q5eEJ eKaL7 Bnaur
    await sendButton.click();
  }

  // add custom methods
  static extend(methods) {
    Object.assign(SnapBot.prototype, methods);
  }
}
