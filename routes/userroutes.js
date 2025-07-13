const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto-js");
const { CleanHTMLData, CleanDBData, checkAuthorization, backendURL, } = require("../config/sanitization");
const multer = require("multer");
const emailTemplate = require("../helpers/emailTemplates/emailTemplates");
const User = require("../models/User");
const CommentSetting = require("../models/CommentSetting");
const Creator = require("../models/Creator");
const { capitalizeName } = require("../helpers/functions");
const Keyword = require("../models/Keyword");
const CommentDetail = require("../models/CommentDetail");
const Package = require("../models/Package");
const UserGeneralDetail = require("../models/UserGeneralDetail");
const Setting = require("../models/Setting");
const LinkedAccount = require("../models/LinkedAccount");
const PackageDetail = require("../models/PackageDetail");
const LinkedAccountTone = require("../models/LinkedAccountTone");
const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");
const { chromium } = require('playwright');
const { saveHar } = require('playwright-har');
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');

const cron = require('node-cron');

const jwtSecretKey = process.env.JWT_SECRET;
const encryptionKey = process.env.KEY;

const ai = new GoogleGenAI({});

router.post("/hi", async (req, res) => {
  const postData = req.body;

  try {
    // Step 1: Fetch accounts
    const linkedAccounts = await LinkedAccount.find({
      userid: "68676510f1a0068cc0f1d408",
      status: "active"
    }).lean();

    // Step 2: Fisher–Yates shuffle
    for (let i = linkedAccounts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [linkedAccounts[i], linkedAccounts[j]] = [linkedAccounts[j], linkedAccounts[i]];
    }

    // Console log each _id
    for (const linkedAccount of linkedAccounts) {
      console.log("🔗 LinkedAccount ID:", linkedAccount._id);
    }

    res.json({
      status: "success",
      message: "Hi",
      linkedAccounts
    });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

router.post("/googleLoginStoreData", async (req, res) => {
  const postData = req.body;
  const email = CleanHTMLData(CleanDBData(postData.email));
  const googleId = CleanHTMLData(CleanDBData(postData.username));
  const firstName = CleanHTMLData(CleanDBData(postData.firstName));
  const lastName = CleanHTMLData(CleanDBData(postData.lastName));

  try {
    let user = await User.findOne({ email });
    let token
    // Check if user exists
    if (user) {
      token = jwt.sign({ id: user._id }, jwtSecretKey, { expiresIn: "1y" });

      if (user.image) {
        user.image = `${backendURL}uploads/images/${user.image}`
      }

      // User exists
      res.json({
        status: "success",
        message: "User logged in successfully",
        token,
        user,
        type: "login"
      });
    } else {
      // Create new user
      user = new User({
        googleId,
        email,
        firstName,
        lastName,
        loginType: "google",
        emailStatus: "verified",
        extensionStatus: false,
        cookieStatus: false,
        image: 'user.png'
      });

      await user.save();

      if (user.image) {
        user.image = `${backendURL}uploads/images/${user.image}`
      }

      token = jwt.sign({ id: user._id }, jwtSecretKey, { expiresIn: "1y" });

      res.json({
        status: "success",
        message: "User registered and logged in successfully",
        token,
        user,
        type: "register"
      });
    }
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

router.post("/register", async (req, res) => {
  const postData = req.body;
  const email = CleanHTMLData(CleanDBData(postData.email));
  const password = CleanHTMLData(CleanDBData(postData.password));
  const firstName = CleanHTMLData(CleanDBData(postData.firstName));
  const lastName = CleanHTMLData(CleanDBData(postData.lastName));

  try {
    // Check if email already exists
    if (await User.findOne({ email })) {
      return res.json({
        status: "error",
        message: "Email already exists",
      });
    }

    // Generate hashed and encrypted password
    const salt = bcrypt.genSaltSync(12);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const encryptedPassword = crypto.AES.encrypt(hashedPassword, encryptionKey).toString();

    const packageid = "6861212a2c4bae8a961b00e0"
    // Create and save the user
    const newUser = new User({
      password: encryptedPassword,
      email,
      loginType: "email",
      firstName,
      lastName,
      emailStatus: "unverified",
      // extensionStatus: false,
      // cookieStatus: false,
      image: 'user.png',
      packageid, // Default package ID, can be changed later
    });

    await newUser.save();


    // const user = await User.findOne({ _id: authUser }); // Find the user by ID
    // user.packageid = newPkgId; // Assign new package ID
    // await user.save(); // Save the updated user document
    const pkgData = await Package.findById(packageid);


    const daysToAdd = 2;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToAdd); // Add 30 days
    const formattedExpirationDate = expirationDate.toISOString();

    // Create a new package detail entry with all columns
    const newPackageDetail = new PackageDetail({
      userid: newUser._id,
      amount: pkgData?.monthlyPrice,
      membershipType: "free",
      type: "upgrade",
      // fromPlanId: postData?.oldPkgId, // Previous plan ID oldPkgId
      toPlanId: packageid,
      expireDate: formattedExpirationDate,
      status: "approved",
    });

    await newPackageDetail.save();

    if (newUser.image) {
      newUser.image = `${backendURL}uploads/images/${newUser.image}`
    }

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1y" });

    res.json({
      status: "success",
      message: "Registration successful.",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Server error occurred during registration.",
    });
  }
});

router.post("/login", async (req, res) => {
  const postData = req.body;
  const emailOrUsername = CleanHTMLData(CleanDBData(postData.identifier));
  const password = CleanHTMLData(CleanDBData(postData.password));
  try {
    // Find the user by email or username
    let user = await User.findOne({
      email: emailOrUsername,
    });

    if (!user) {
      return res.json({
        status: "error",
        message: "Email is incorrect",
      });
    }

    const decryptedPassword = crypto.AES.decrypt(user.password, encryptionKey).toString(crypto.enc.Utf8);
    const passwordMatched = await bcrypt.compare(password, decryptedPassword);
    if (!passwordMatched) {
      return res.json({
        status: "error",
        message: "Password is incorrect",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1y" });

    // Log successful login

    if (user.image) {
      user.image = `${backendURL}uploads/images/${user.image}`
    }

    res.json({
      status: "success",
      message: "Logged in successfully!",
      token,
      user,
    });
  } catch (error) {
    console.log(error);
    res.json({ status: "error", message: "Internal Server Error" });
  }
});

router.post("/verifyToken", async (req, res) => {
  try {
    const authUser = await checkAuthorization(req, res);
    // console.log("🚀 ~ exports.verifyToken= ~ authUser:", typeof authUser, authUser)
    if (authUser) {
      let user = await User.findById(authUser);
      const pkgData = await Package.findById(user.packageid);
      const packageDetails = await PackageDetail.findOne({ userid: authUser });
      user = { ...user.toObject(), pkgData, packageDetails, };
      if (user.image) {
        user.image = `${backendURL}uploads/images/${user.image}`
      }

      res.json({ status: "success", user });
    }
  } catch (error) {
    console.log("error:", error);
    res.json({ status: "error", message: "Error fetching user profile" });
  }
});

router.post("/getPlans", async (req, res) => {
  const postData = req.body;
  const userid = CleanHTMLData(CleanDBData(postData.userid));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await Package.find({ type: "default" });

      res.json({
        status: "success",
        data: data,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Server error occurred during registration.",
    });
  }
});

router.post("/updatePlan", async (req, res) => {
  const postData = req.body;
  const newPkgId = postData?.newPkgId;
  const type = postData?.type;
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const user = await User.findOne({ _id: authUser }); // Find the user by ID
      user.packageid = newPkgId; // Assign new package ID
      await user.save(); // Save the updated user document
      const pkgData = await Package.findById(user.packageid);

      const daysToAdd = 30;
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + daysToAdd); // Add 30 days
      const formattedExpirationDate = expirationDate.toISOString();

      // Create a new package detail entry with all columns
      const newPackageDetail = new PackageDetail({
        userid: authUser, // Assign authenticated user ID
        amount: pkgData?.monthlyPrice, // Assign amount
        membershipType: "monthly", // renew/upgrade/new
        type: "upgrade", // monthly, yearly
        fromPlanId: postData?.oldPkgId, // Previous plan ID oldPkgId
        toPlanId: postData?.newPkgId, // New plan ID
        expireDate: formattedExpirationDate, // Expiration date
        status: "approved", // Status (active, pending, etc.)
      });

      await newPackageDetail.save(); // Save the new entry in the database

      res.json({
        status: "success",
        message: "User package has been updated successfully",
        pkgData: pkgData,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Server error occurred during registration.",
    });
  }
});

router.post("/userCommentDetail", async (req, res) => {
  const postData = req.body;
  // const hear = CleanHTMLData(CleanDBData(postData.hear));
  // const industry = CleanHTMLData(CleanDBData(postData.industry));
  // const values = CleanHTMLData(CleanDBData(postData.values));
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await CommentDetail.find({ userid: authUser, creatorid: { $exists: true } });

      const enrichedData = await Promise.all(
        data.map(async (item) => {
          const [creator, linkedAccount] = await Promise.all([
            Creator.findById(item.creatorid).select("name"),
            LinkedAccount.findById(item.linkedAccountId).select("name") // change 'name' if your field is different
          ]);

          return {
            ...item._doc,
            creatorName: creator?.name || "Unknown Creator",
            linkedAccountName: linkedAccount?.name || "Unknown Account"
          };
        })
      );

      return res.json({
        status: "success",
        data: enrichedData
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});

router.post("/generalDetail", async (req, res) => {
  const postData = req.body;
  const hear = CleanHTMLData(CleanDBData(postData.hear));
  const industry = CleanHTMLData(CleanDBData(postData.industry));
  const values = CleanHTMLData(CleanDBData(postData.values));
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const newUserGeneralDetail = new UserGeneralDetail({
        userid: authUser,
        industry: industry,
        marketingSource: hear,
        keyWords: values,
      });

      // Save the new data to the database
      await newUserGeneralDetail.save();

      return res.json({
        status: "success",
        message: "hear submit",
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});



let browser, page;

async function launchBrowser() {
  try {
    const userDataDir = path.resolve(__dirname, '../tmp/linkedin-profile-admin');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: null,
      args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'],
    });

    page = browser.pages().length ? browser.pages()[0] : await browser.newPage();

    page.setDefaultTimeout(60000); // changes default for all waits

    // Stealth setup
    await browser.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      navigator.getBattery = async () => ({
        charging: true,
        level: 1,
        chargingTime: 0,
        dischargingTime: Infinity
      });
      navigator.maxTouchPoints = 1;

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);

      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) return "Intel Inc.";
        if (parameter === 37446) return "Intel Iris OpenGL Engine";
        return getParameter.call(this, parameter);
      };

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const copy = audioContext.createAnalyser;
      audioContext.createAnalyser = function () {
        const analyser = copy.call(this);
        analyser.getFloatFrequencyData = function () { };
        return analyser;
      };
    });

    // Check if already logged in
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    const alreadyLoggedIn = await page.$('img.global-nav__me-photo') !== null;

    if (alreadyLoggedIn) {
      console.log("✅ Already logged in.");
      return;
    }

    console.log("🔐 Not logged in. Attempting login...");

    const cookies = await browser.cookies('https://www.linkedin.com');
    if (cookies.length) {
      await browser.clearCookies();
      console.log("🧹 Cleared stale cookies.");
    }

    const freshLogins = await Setting.find({ name: "login", status: "fresh" });

    for (let login of freshLogins) {
      const { email, password } = login.value;
      console.log(`🔄 Trying login for: ${email}`);

      try {
        await page.goto("https://www.linkedin.com/login", { waitUntil: 'domcontentloaded' });

        await page.waitForSelector('input[name="session_key"]', { state: 'visible', timeout: 7000 });
        await page.click('input[name="session_key"]');
        await page.type('input[name="session_key"]', email, { delay: 100 });

        await page.click('input[name="session_password"]');
        await page.type('input[name="session_password"]', password, { delay: 100 });

        await page.click('button[type="submit"]');
        await page.waitForSelector('img.global-nav__me-photo', { state: 'visible', timeout: 10000 });

        const isLoggedIn = await page.$('img.global-nav__me-photo');

        if (isLoggedIn) {
          console.log("✅ Login successful.");
          await Setting.updateOne({ _id: login._id }, { $set: { status: "used" } });
          return;
        } else {
          console.log(`❌ Login failed for: ${email}`);
          await Setting.updateOne({ _id: login._id }, { $set: { status: "failed" } });
        }
      } catch (err) {
        console.error(`⚠️ Login attempt error for ${email}:`, err.message);
        await Setting.updateOne({ _id: login._id }, { $set: { status: "failed" } });
      }
    }

    console.log("🚫 All login attempts failed.");
  } catch (error) {
    console.log("error in launchBrowser", error)
  }
}


async function keepBrowserAlive() {
  if (!browser || !page) {
    await launchBrowser();
  }

  // Optional: uncomment this to keep browser alive
  // setInterval(async () => {
  //   try {
  //     console.log("⏳ Browser is still alive...");
  //   } catch (error) {
  //     console.error("⚠️ Error keeping browser alive:", error);
  //     await launchBrowser();
  //   }
  // }, 60000); // every 1 minute
}

// Optional to start automatically
// keepBrowserAlive();

router.post("/linkedAccount", async (req, res) => {
  const postData = req.body;
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await LinkedAccount.find({
        userid: authUser,
        status: "active",
      });

      const ids = data.map(item => item._id);
      // console.log(ids);

      // Find all commentSettings where linkedAccountId matches the ids
      const linkedAccountToggle = await CommentSetting.find({ linkedAccountId: { $in: ids }, creatorid: "0" });
      // console.log("🚀 ~ router.post ~ linkedAccountToggle:", linkedAccountToggle);

      // Map commentSettings to the respective linked account
      data.forEach(entry => {
        // Modify the imageUrl if it's 'user.png'
        if (entry.imageUrl === 'user.png') {
          entry.imageUrl = `${backendURL}uploads/images/user.png`;
        }

        // Get the commentSettings for the current entry
        const entrySettings = linkedAccountToggle.filter(toggle => toggle.linkedAccountId.toString() === entry._id.toString());

        // Add the filtered settings to the entry
        entry.set("commentSettings", entrySettings[0], { strict: false });
      });

      return res.json({
        data,
        totalActiveAccounts: data.length,
        status: "success",
      });
    }
  } catch (error) {
    console.error("error during change password", error.message);
    res.json({ message: "error during change password", error });
  }
});

router.post("/linkedAccountDel", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await LinkedAccount.findOneAndUpdate(
        { _id: id },
        { status: "inactive" }
      );

      await User.findOneAndUpdate({ _id: authUser }, { cookieStatus: false });

      return res.json({
        status: "success",
        message: "Linked Account Deleted",
      });
    }
  } catch (error) {
    console.error("error during change password", error.message);
    res.json({ message: "error during change password", error });
  }
});

router.post("/linkedAccountPageStatus", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));
  const pageId = CleanHTMLData(CleanDBData(postData.pageId));
  const value = postData.value

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const linkedAccount = await LinkedAccount.findOne({ _id: id });
      let pageData = JSON.parse(linkedAccount.pageData);

      pageData = pageData.map(page => {
        // console.log("pages:", page)
        if (value == true) {
          // console.log("value true ===>", value, "page.pageId", pageId)
          // When value is true, set all statuses to false except the matched page
          return page._id === pageId ? { ...page, status: true } : { ...page, status: false };
        } else {
          // console.log("value false ==>", value, "page.pageId", pageId)
          // When value is false, only change the status of the matched page
          return page._id === pageId ? { ...page, status: false } : page;
        }
      });

      // console.log("pageData:", pageData)

      linkedAccount.pageData = JSON.stringify(pageData);

      await linkedAccount.save();

      return res.json({
        status: "success",
        message: "Linked Account Page Status Updated",
      });
    }
  } catch (error) {
    console.error(error.message);
    res.json({ message: "Something went Wrong", error });
  }
});

router.post("/linkedAccountForCreator", async (req, res) => {
  const postData = req.body;
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const data = await LinkedAccount.find({
        userid: authUser,
        status: "active",
      });

      if (data && data.length > 0) {
        for (const account of data) {

          if (account.imageUrl === "user.png") {
            account.imageUrl = `${backendURL}uploads/images/${account.imageUrl}`;
          }

          const commentSetting = await CommentSetting.findOne({
            linkedAccountId: account._id,
            creatorid: "0",
          });
          // console.log("🚀 ~ router.post ~ commentSetting:", commentSetting)

          account.set("commentSettings", commentSetting, { strict: false });
        }
      }
      // console.log("🚀 ~ router.post ~ data:", data)
      return res.json({
        data,
        status: "success",
      });
    }
  } catch (error) {
    console.error("Error during fetching linked accounts and comment settings", error.message);
    res.status(500).json({ message: "Error during fetching linked accounts and comment settings", error });
  }
});

router.post("/findCreator", async (req, res) => {
  const postData = req.body;
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.selectedAccountId));
  const creatorLink = CleanHTMLData(CleanDBData(postData.creatorLink));
  const linkedAccountPageId = CleanHTMLData(CleanDBData(postData.selectedAccountPageId));
  const toggles = JSON.parse(postData.toggles);

  // let page;

  try {
    const authUser = await checkAuthorization(req, res);
    if (!authUser) return;

    page = await browser.newPage();

    await page.goto(creatorLink, { waitUntil: "domcontentloaded" });
    console.log("goto", creatorLink)
    const htmlSelector = "img.pv-top-card-profile-picture__image--show.evi-image.ember-view";
    const tagLineHtmlSelector = '.text-body-medium[data-generated-suggestion-target*="urn:li:"]';
    const nameHtmlSelector = "h1.inline.t-24.v-align-middle.break-words";
    console.log("after selector")
    await page.waitForSelector(htmlSelector, { state: "visible", timeout: 30000 });

    const profileData = await page.evaluate(({ imgSel, tagSel, nameSel }) => {
      const imageNode = document.querySelector(imgSel);
      const tagNode = document.querySelector(tagSel);
      const nameNode = document.querySelector(nameSel);

      const imageUrl = imageNode?.src || "user.png";
      const tagLine = tagNode?.textContent?.trim().replace(/\s+/g, " ") || "No Tag Line found";
      const name = nameNode?.textContent?.trim().replace(/\s+/g, " ") || "No Name found";

      return { imageUrl, tagLine, name };
    }, { imgSel: htmlSelector, tagSel: tagLineHtmlSelector, nameSel: nameHtmlSelector });

    console.log("Profile Image URL:", profileData);

    const baseCreatorData = {
      linkedAccountId,
      url: creatorLink,
      imageUrl: profileData.imageUrl,
      tagLine: profileData.tagLine,
      name: profileData.name,
      status: "active",
      lastScrapedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    };

    const newCreator = linkedAccountPageId !== "undefined"
      ? { ...baseCreatorData, linkedAccountPageId, isPageSpecific: true }
      : baseCreatorData;

    const updatedCreator = await Creator.findOneAndUpdate(
      { linkedAccountId, url: creatorLink },
      { $set: newCreator },
      { upsert: true, new: true }
    );

    const existingSetting = await CommentSetting.findOne({ linkedAccountId, creatorid: "0" });

    const isDifferent =
      !existingSetting ||
      existingSetting.emoji !== toggles.emoji ||
      existingSetting.hashtag !== toggles.hashtag ||
      // existingSetting.lowercase !== toggles.lowercase ||
      existingSetting.exclamation !== toggles.exclamation ||
      // existingSetting.friendlytone !== toggles.friendlytone ||
      existingSetting.author !== toggles.author;

    if (isDifferent) {
      await CommentSetting.findOneAndUpdate(
        { linkedAccountId, creatorid: updatedCreator._id },
        {
          creatorid: updatedCreator._id,
          emoji: toggles.emoji,
          hashtag: toggles.hashtag,
          // lowercase: toggles.lowercase,
          exclamation: toggles.exclamation,
          // friendlytone: toggles.friendlytone,
          author: toggles.author,
          status: true,
        },
        { upsert: true, new: true }
      );
    }

    res.json({ status: "success", message: "Creator added" });

  } catch (error) {
    console.error("❌ Error during creator registration:", error);
    res.json({
      status: "error",
      message: "Something went wrong",
    });
  } finally {
    if (page) await page.close();
  }
});

router.post("/getCreator", async (req, res) => {
  const postData = req.body;
  const selectedAccount = CleanHTMLData(CleanDBData(postData.selectedAccount));
  const linkedAccountPageId = CleanHTMLData(CleanDBData(postData.selectedAccountPage));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      let data;
      if (linkedAccountPageId != "undefined") {
        data = await Creator.find({
          linkedAccountId: selectedAccount,
          linkedAccountPageId,
          status: "active",
        });
      } else {
        data = await Creator.find({
          linkedAccountId: selectedAccount,
          status: "active",
          isPageSpecific: { $exists: false },
        });
      }
      res.json({
        status: "success",
        data: data,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something went wrong",
    });
  }
});

router.post("/deleteCreator", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));
  const selectedAccountPage = CleanHTMLData(CleanDBData(postData.selectedAccountPage));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      if (selectedAccountPage != "undefined") {
        // await Creator.findByIdAndUpdate(
        //   { _id: id },
        //   { $unset: { linkedAccountPageId: 1, isPageSpecific: 1 } }, // Removes the field
        //   { new: true }
        // );

        // await Creator.findByIdAndUpdate(
        //   id,
        //   [
        //     {
        //       $set: {
        //         status: {
        //           $cond: {
        //             if: { $gt: ["$isPageSpecific", null] }, // Check if isPageSpecific exists
        //             then: "inactive", // Set status to inactive
        //             else: "$status", // Keep status unchanged
        //           },
        //         },
        //       },
        //     },
        //     { $unset: "linkedAccountPageId" }, // Always remove linkedAccountPageId
        //   ],
        //   { new: true }
        // );

        await Creator.findByIdAndUpdate(
          id,
          [
            {
              $set: {
                status: {
                  $cond: {
                    if: { $gt: ["$isPageSpecific", null] }, // Check if isPageSpecific exists
                    then: "inactive", // Set status to inactive
                    else: "$status", // Keep status unchanged
                  },
                },
              },
            },
            {
              $set: {
                linkedAccountPageId: {
                  $cond: {
                    if: { $eq: [{ $size: "$linkedAccountPageId" }, 1] }, // If only 1 element exists
                    then: "$$REMOVE", // Remove the entire field
                    else: {
                      $filter: {
                        input: "$linkedAccountPageId",
                        as: "page",
                        cond: { $ne: ["$$page", selectedAccountPage] }, // Remove matching element
                      },
                    },
                  },
                },
              },
            },
          ],
          { new: true }
        );
      }
      else {
        await Creator.findOneAndUpdate({ _id: id }, { status: "inactive" });
      }

      res.json({
        status: "success",
        message: "Creator deleted",
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/findLinkedAccountSetting", async (req, res) => {
  const postData = req.body;
  const ids = postData.id
  // console.log("🚀 ~ router.post ~ ids:", ids)

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const linkedAccountToggle = await CommentSetting.find({ linkedAccountId: { $in: ids }, creatorid: "0" })
      const linkedAccountToneGender = await LinkedAccountTone.find({ linkedAccountId: { $in: ids } })
      // console.log("🚀 ~ router.post ~ linkedAccountToggle:", linkedAccountToggle)

      res.json({
        status: "success",
        linkedAccountToggle,
        linkedAccountToneGender
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/singleUpdateCommentSettingLinkedAccount", async (req, res) => {
  const postData = req.body;
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccount));
  const key = CleanHTMLData(CleanDBData(postData.key));
  const value = CleanHTMLData(CleanDBData(postData.value));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      await CommentSetting.findOneAndUpdate(
        { linkedAccountId, creatorid: '0' }, // find the document by linkedAccountId
        { $set: { [key]: value } }, // update the specified key with the new value
        { new: true } // return the updated document
      );
      // upsert: true
      res.json({
        status: "success",
        message: `${key.charAt(0).toUpperCase() + key.slice(1)} is turned ${value === "true" ? "on" : "off"}`,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/singleGetCommentSettingCreatorAccount", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.id));
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccountId));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      let creatorSettings = await CommentSetting.findOne({ creatorid: id });

      if (creatorSettings === null) {
        creatorSettings = await CommentSetting.findOne({ linkedAccountId });
      }

      // console.log("🚀 ~ router.post ~ creatorSettings:", creatorSettings)

      res.json({
        status: "success",
        data: creatorSettings,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/singleUpdateCommentSettingCreatorAccount", async (req, res) => {
  const postData = req.body;
  const creatorAccount = CleanHTMLData(CleanDBData(postData.creatorAccount));
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccountId));
  const toggles = JSON.parse(postData.toggles);

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const commentSetting = await CommentSetting.findOneAndUpdate(
        { linkedAccountId: linkedAccountId, creatorid: creatorAccount },
        {
          emoji: toggles.emoji, hashtag: toggles.hashtag,
          exclamation: toggles.exclamation,
          author: toggles.author, status: true
        },
        { upsert: true, new: true }
      );

      res.json({
        status: "success",
        message: `Setting updated`,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/importPageData", async (req, res) => {
  const postData = req.body;
  const selectedAccount = CleanHTMLData(CleanDBData(postData.selectedAccount));
  const linkedAccountPageId = CleanHTMLData(CleanDBData(postData.selectedAccountPage));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      // const updatedData = await Creator.updateMany(
      //   { linkedAccountId: selectedAccount, status: "active", },
      //   { $set: { linkedAccountPageId, }, }
      // );

      await Creator.updateMany(
        { linkedAccountId: selectedAccount, status: "active" },
        {
          $addToSet: {
            linkedAccountPageId: { $each: Array.isArray(linkedAccountPageId) ? linkedAccountPageId : [linkedAccountPageId] }
          }
        }
      );

      res.json({
        status: "success",
        message: `Setting updated`,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

// tone
router.post("/linkedAccountGetToneAllByUserId", async (req, res) => {
  const postData = req.body;
  const userId = CleanHTMLData(CleanDBData(postData.userId));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {

      const LinkedAccountData = await LinkedAccount.find({ userid: authUser, status: "active" });
      const LinkedAccountToneData = await LinkedAccountTone.find({ userid: authUser });
      // console.log("🚀 ~ router.post ~ LinkedAccountData:", LinkedAccountData)

      let linkedAccountPageTones = []

      for (const entry of LinkedAccountData) {
        if (entry.imageUrl === 'user.png') {
          entry.imageUrl = `${backendURL}uploads/images/user.png`;
        }
        // if(Array.isArray(JSON.parse(entry.pageData)) && entry.pageData !== 'No company found'){
        if (entry.pageData && entry.pageData !== 'No company found') {
          let parseData = JSON.parse(entry.pageData)
          // console.log("🚀 ~ router.post ~ parseData:", parseData)
          // Extract the _id values from your input data
          const linkedAccountIds = parseData.map(item => item._id);

          linkedAccountPageTones = await LinkedAccountTone.find({
            linkedAccountPageId: { $in: linkedAccountIds }
          });
        }
      }

      res.json({
        status: "success",
        LinkedAccountData,
        LinkedAccountToneData,
        linkedAccountPageTones
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something went wrong",
    });
  }
});

router.post("/linkedAccountUpdateTone", async (req, res) => {
  const postData = req.body;
  const title = CleanHTMLData(CleanDBData(postData.title));
  const selectedValue = CleanHTMLData(CleanDBData(postData.selectedValue));
  const linkedAccount = CleanHTMLData(CleanDBData(postData.linkedAccount));
  const linkedAccountPageTone = CleanHTMLData(CleanDBData(postData.linkedAccountPageTone));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      if (linkedAccountPageTone == "null") {
        // console.log('profile tone')
        await LinkedAccountTone.findOneAndUpdate(
          { linkedAccountId: linkedAccount },
          { $set: { [title]: selectedValue } },  // Dynamic field update
          { new: true }  // Return the updated document
        );
      } else {
        // console.log('page tone')
        await LinkedAccountTone.findOneAndUpdate(
          { linkedAccountPageId: linkedAccountPageTone },
          { $set: { [title]: selectedValue } },  // Dynamic field update
          { new: true }  // Return the updated document
        );
      }
      res.json({
        status: "success",
        message: `${title.charAt(0).toUpperCase() + title.slice(1)} updated successfully`
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/linkedAccountGenderChange", async (req, res) => {
  const postData = req.body;
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccountId));
  const value = CleanHTMLData(CleanDBData(postData.value));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {

      await LinkedAccountTone.findOneAndUpdate(
        { linkedAccountId: linkedAccountId },
        { gender: value },
        { new: true, upsert: true }
      );

      res.json({
        status: "success",
        message: 'Gender Updated successfully'
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/images";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); // Create directory if not exists
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    const newFileName = `image_${Date.now()}${fileExt}`;
    cb(null, newFileName);
  }
});

// Multer Upload Middleware
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, JPG, and WEBP images are allowed"));
    }
    cb(null, true);
  }
});

router.post("/userinfoUpdate", upload.single("image"), async (req, res) => {
  const postData = req.body;
  const firstName = CleanHTMLData(CleanDBData(postData.firstName));
  const lastName = CleanHTMLData(CleanDBData(postData.lastName));
  const email = CleanHTMLData(CleanDBData(postData.email));
  const contact = CleanHTMLData(CleanDBData(postData.contact));
  const address1 = CleanHTMLData(CleanDBData(postData.address1));
  const address2 = CleanHTMLData(CleanDBData(postData.address2));
  const city = CleanHTMLData(CleanDBData(postData.city));
  const country = CleanHTMLData(CleanDBData(postData.country));
  const bio = CleanHTMLData(CleanDBData(postData.bio));

  // Handle Image Upload
  let imagePath = "";
  if (req.file) {
    // Store the filename with the path
    imagePath = `${req.file.filename}`;
  } else if (postData.image) {
    // If no new file but existing image path provided
    imagePath = postData.image.split("/").pop();
  }

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {

      const updatedUser = await User.findByIdAndUpdate(
        authUser, // Assuming `authUser` contains the user's ID
        {
          firstName, lastName, email, contact, address1, address2, city,
          bio, country, image: imagePath
        },
        { new: true, runValidators: true }
      );

      res.json({
        status: "success",
        message: "Profile Updated"
      });
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    res.json({
      status: "error",
      message: "Something went wrong",
    });
  }
});



router.post("/updatedPasswordAndSetting", async (req, res) => {
  const postData = req.body;
  console.log("🚀 ~ router.post ~ postData:", postData)
  const currentPassword = CleanHTMLData(CleanDBData(postData.currentPassword));
  const newPassword = CleanHTMLData(CleanDBData(postData.newPassword));
  const has2FA = CleanHTMLData(CleanDBData(postData.has2FA));
  const allowUpdate = CleanHTMLData(CleanDBData(postData.allowUpdate));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const user = await User.findById(authUser);

      const decryptedPassword = crypto.AES.decrypt(user.password, encryptionKey).toString(crypto.enc.Utf8);
      const passwordMatched = await bcrypt.compare(currentPassword, decryptedPassword);
      if (!passwordMatched) {
        return res.json({
          status: "error",
          message: "The current password you entered is incorrect.",
        });
      }

      // Generate hashed and encrypted password
      const salt = bcrypt.genSaltSync(12);
      const hashedPassword = bcrypt.hashSync(newPassword, salt);
      const encryptedPassword = crypto.AES.encrypt(hashedPassword, encryptionKey).toString();

      await User.findOneAndUpdate({ _id: authUser }, { password: encryptedPassword });

      res.json({
        status: "success",
        message: "Your password and settings have been successfully updated."
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});










// keyword
router.post("/addKeyword", async (req, res) => {
  const postData = req.body;
  const keywords = CleanHTMLData(CleanDBData(postData.keywords));
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccountId));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      await Keyword.findOneAndUpdate(
        { userid: authUser, linkedAccountId, },
        { $set: { status: "active", keyword: keywords, lastScrapedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } },
        { upsert: true, new: true, }
      );

      res.json({
        status: "success",
        message: "Keyword added",
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/findLinkedKeywordSetting", async (req, res) => {
  const postData = req.body;
  const ids = postData.id
  // console.log("🚀 ~ router.post ~ ids:", ids)

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const linkedAccountToggle = await CommentSetting.find({ linkedAccountId: { $in: ids }, keywordid: "0" })
      const linkedAccountKeywords = await Keyword.find({ linkedAccountId: { $in: ids } })

      res.json({
        status: "success",
        linkedAccountToggle,
        linkedAccountKeywords
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/singleUpdateCommentSettingKeyword", async (req, res) => {
  const postData = req.body;
  const linkedAccountId = CleanHTMLData(CleanDBData(postData.linkedAccount));
  const key = CleanHTMLData(CleanDBData(postData.key));
  const value = CleanHTMLData(CleanDBData(postData.value));

  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      await CommentSetting.findOneAndUpdate(
        { linkedAccountId, keywordid: "0" }, // find the document by linkedAccountId
        { $set: { [key]: value } }, // update the specified key with the new value
        { new: true } // return the updated document
      );
      // upsert: true
      res.json({
        status: "success",
        message: `${key.charAt(0).toUpperCase() + key.slice(1)} is turned ${value === "true" ? "on" : "off"}`,
      });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/keywordCommentDetail", async (req, res) => {
  const postData = req.body;
  // const hear = CleanHTMLData(CleanDBData(postData.hear));
  // const industry = CleanHTMLData(CleanDBData(postData.industry));
  // const values = CleanHTMLData(CleanDBData(postData.values));
  try {
    const authUser = await checkAuthorization(req, res);
    if (authUser) {
      const keywords = await Keyword.find({ userid: authUser })
      const keywordIds = keywords?.map(k => k._id);
      const data = await CommentDetail.find({ userid: authUser, keywordid: { $in: keywordIds } });
      
      const enrichedData = await Promise.all(
        data.map(async (item) => {
          const [creator, linkedAccount] = await Promise.all([
            Creator.findById(item.creatorid).select("name"),
            LinkedAccount.findById(item.linkedAccountId).select("name") // change 'name' if your field is different
          ]);

          return {
            ...item._doc,
            creatorName: creator?.name || "Unknown Creator",
            linkedAccountName: linkedAccount?.name || "Unknown Account"
          };
        })
      );

      return res.json({
        status: "success",
        data: enrichedData
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});

// router.post("/getKeyword", async (req, res) => {
//   const postData = req.body;
//   // const userid = CleanHTMLData(CleanDBData(postData.userid));
//   try {
//     const authUser = await checkAuthorization(req, res);
//     if (authUser) {
//       const data = await Keyword.find({ userid: authUser, status: "active" });

//       res.json({
//         status: "success",
//         data: data,
//       });
//     }
//   } catch (error) {
//     console.error("Error during registration:", error);
//     res.json({
//       status: "error",
//       message: "Something want wrong",
//     });
//   }
// });

// router.post("/deleteKeyword", async (req, res) => {
//   const postData = req.body;
//   const id = CleanHTMLData(CleanDBData(postData.id));
//   try {
//     const authUser = await checkAuthorization(req, res);
//     if (authUser) {
//       await Keyword.findOneAndUpdate({ _id: id }, { status: "inactive" });

//       res.json({
//         status: "success",
//         message: "Keyword deleted",
//       });
//     }
//   } catch (error) {
//     console.error("Error during registration:", error);
//     res.json({
//       status: "error",
//       message: "Something want wrong",
//     });
//   }
// });

// router.post("/findKeywordSetting", async (req, res) => {
//   const postData = req.body;
//   const id = CleanHTMLData(CleanDBData(postData.id));

//   try {
//     const authUser = await checkAuthorization(req, res);
//     if (authUser) {
//       const CreatorData = await Keyword.findById(id);
//       let data;
//       data = await CommentSetting.findOne({ keywordid: id });
//       // console.log("🚀 ~ router.post ~ data:", data)

//       if (data === null) {
//         data = await CommentSetting.findOne({ creatorid: "0" });
//       }

//       res.json({
//         status: "success",
//         data: { data, CreatorData },
//       });
//     }
//   } catch (error) {
//     console.error("Error during registration:", error);
//     res.json({
//       status: "error",
//       message: "Something want wrong",
//     });
//   }
// });

// router.post("/singleUpdateCommentSettingKeyword", async (req, res) => {
//   const postData = req.body;
//   const keywordid = CleanHTMLData(CleanDBData(postData.creatorId));
//   const key = CleanHTMLData(CleanDBData(postData.key));
//   const value = CleanHTMLData(CleanDBData(postData.value));

//   try {
//     const authUser = await checkAuthorization(req, res);
//     if (authUser) {
//       let userSettings = await CommentSetting.findOne({ keywordid });
//       if (!userSettings) {
//         // If the record does not exist, create it with the provided key-value
//         // and set all other fields to false by default
//         const generalSetting = await CommentSetting.findOne({ creatorid: "0" });
//         // Initialize new settings with defaults or general settings
//         const newSettings = {
//           keywordid,
//           userid: authUser,
//           emojis: generalSetting?.emoji || false,
//           hashtag: generalSetting?.hashtag || false,
//           // lowercase: generalSetting?.lowercase || false,
//           exclamation: generalSetting?.exclamation || false,
//         };
//         newSettings[key] = value; // Set the provided field value
//         userSettings = new CommentSetting(newSettings);
//       } else {
//         // If the record exists, update only the specified field
//         userSettings[key] = value;
//       }

//       await userSettings.save();

//       res.json({
//         status: "success",
//         message: `${key.charAt(0).toUpperCase() + key.slice(1)} is turned ${value === "true" ? "on" : "off"
//           }`,
//       });
//     }
//   } catch (error) {
//     console.error("Error during registration:", error);
//     res.json({
//       status: "error",
//       message: "Something want wrong",
//     });
//   }
// });








// password



router.post("/forgotpassword", async (req, res) => {
  const postData = req.body;
  try {
    const email = CleanHTMLData(CleanDBData(postData.email));
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.json({ status: "error", message: "User not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.forgotpasswordotp = otp;
    await user.save();
    return res.json({
      status: "success",
      message:
        "An email has been sent to your registered email with the OTP. Please check your inbox.",
      otp,
    });
  } catch (error) {
    console.error("Error OTP generated", error.message);
    res.json({ message: "Error OTP generated", error });
  }
});

router.post("/checkforgotpasswordotp", async (req, res) => {
  const postData = req.body;
  try {
    const otp = CleanHTMLData(
      CleanDBData(Object.values(postData).slice(0, -1).join(""))
    );
    const email = CleanHTMLData(CleanDBData(postData.email));
    const Otp = await User.findOne({ forgotpasswordotp: otp });
    const Email = await User.findOne({ email: email });
    if (!Otp) {
      return res.json({ status: "error", message: "Invalid otp" });
    }
    if (!Email) {
      return res.json({ status: "error", message: "Invalid email" });
    }
    return res.json({
      status: "success",
      message: "OTP matched successfully",
    });
  } catch (error) {
    console.error("Invalid OTP", error.message);
    res.json({ message: "Invalid OTP", error });
  }
});

router.post("/changeforgotpassword", async (req, res) => {
  const postData = req.body;
  const email = CleanHTMLData(CleanDBData(postData.email));
  const password = CleanHTMLData(CleanDBData(postData.password));
  try {
    const salt = bcrypt.genSaltSync(12);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const encryptedPassword = crypto.AES.encrypt(
      hashedPassword,
      encryptionKey
    ).toString();

    const Email = await User.findOne({ email: email });
    if (!Email) {
      return res.json({ status: "error", message: "Invalid email" });
    }
    await User.updateOne(
      { email: email },
      { $set: { password: encryptedPassword } }
    );
    return res.json({
      status: "success",
      message: "Password has been changed successfully",
    });
  } catch (error) {
    console.error("error during change password", error.message);
    res.json({ message: "error during change password", error });
  }
});




// function for delay
function delay(time) { return new Promise((resolve) => setTimeout(resolve, time)); }

router.post("/addPackage", async (req, res) => {
  try {
    // const { name, price, commentLimit, accountLimit, profileLimit, pageLimit, bothActive, status } = req.body;
    const name = "Custom";
    const price = "150";
    const commentLimit = "50";
    const accountLimit = "5";
    const profileLimit = "5";
    const creatorLimit = "50";
    const pageLimit = "5";
    const bothActive = false;
    const status = "active";
    const type = "custom";
    const monthlyPrice = "10";
    const yearlyPrice = "110";

    // Check if all required fields are provided
    if (
      !name ||
      !price ||
      !commentLimit ||
      !accountLimit ||
      !profileLimit ||
      !pageLimit ||
      !yearlyPrice ||
      !monthlyPrice ||
      bothActive === undefined ||
      !status ||
      !type
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Create a new Package instance
    const newPackage = new Package({
      name,
      price,
      commentLimit,
      accountLimit,
      // profileLimit,
      pageLimit,
      bothActive,
      creatorLimit,
      status,
      type,
      monthlyPrice,
      yearlyPrice
    });

    // Save the new package to the database
    await newPackage.save();

    return res
      .status(201)
      .json({ message: "Package added successfully", data: newPackage });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/addSetting", async (req, res) => {
  try {
    const name = "cookie";
    const value =
      "AQEDASIlnxkE1eKlAAABlUGUFy0AAAGVZaCbLU0Ae0fu27eN4gtJgPxG9bMFeW81O0_oZc7rqGpwKipW1zOsvYdFrGJK1uRIxAeBCKq5cHJZU-VBtxGnzQtLJ6biz4XXn2a_Oa_eWxoNXoFqvQnAnQuI";
    const setting = new Setting({ name, value });
    // Save the setting to the database
    await setting.save();
    return res.status(201).json({ message: "Setting added successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post('/linked-account-tone-one-time', async (req, res) => {
  try {
    const userid = "0";
    const linkedAccountId = "0";
    const tone = "friendly";  // Hardcoded tone, e.g., 'professional', 'friendly', etc.
    const formalityLevel = "semiFormal";  // Hardcoded formality level, e.g., 'formal', 'semiFormal', etc.
    const questionsFrequency = "sometimes";  // Hardcoded question frequency, e.g., 'frequently', 'sometimes', etc.
    const commentsLength = "medium";  // Hardcoded comment length, e.g., 'short', 'medium', etc.
    const personality = "optimistic";  // Hardcoded personality, e.g., 'analytical', 'optimistic', etc.

    // Create a new instance of the LinkedAccountTone model
    const newLinkedAccountTone = new LinkedAccountTone({
      userid,
      linkedAccountId,
      tone,
      formalityLevel,
      questionsFrequency,
      commentsLength,
      personality,
    });

    // Save the data to MongoDB
    const savedData = await newLinkedAccountTone.save();

    // Send response
    res.status(201).json({ message: 'Data saved successfully', data: savedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error saving data', error });
  }
});

// cron.schedule('*/30 * * * *', async () => {
//   console.log('Running cron job every 30 min');
cron.schedule('* * * * *', async () => {
  console.log('Running cron job every 1 min');
  // await cronJobToGetRecentPostsMultiTab();
}, {
  timezone: "Asia/Karachi"
});


async function cronJobToGetRecentPostsMultiTab() {
  try {
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(10); // Control concurrency

    const users = await User.find({ role: { $ne: 'admin' } });

    for (const user of users) {
      const userid = user._id.toString();
      const linkedAccounts = await LinkedAccount.find({ userid, status: "active", cookieStatus: true }).lean()

      // console.log("🚀 ~ cronJobToGetRecentPostsMultiTab ~ linkedAccounts:", linkedAccounts.length)

      for (const linkedAccount of linkedAccounts) {
        const linkedAccountId = linkedAccount._id.toString();

        const twentyFourHoursAgoISOString = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const creators = await Creator.find({
          linkedAccountId,
          status: "active",
          lastScrapedAt: { $lt: twentyFourHoursAgoISOString }
        }).lean();

        // Shuffle the creators array
        for (let i = creators.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [creators[i], creators[j]] = [creators[j], creators[i]];
        }

        if (creators.length === 0) continue;

        console.log("🚀 ~ cronJobToGetRecentPostsMultiTab ~ creators:", creators.length, "userid", userid, "linkedAccountId", linkedAccountId)

        // Only update those that were actually scraped successfully
        const tasks = creators.map(creator =>
          limit(() => scrapeRecentPost({ creator, userid, linkedAccountId }))
        );

        await Promise.all(tasks);
      }
    }
  } catch (error) {
    console.error("❌ Error in fetch-latest-posts:", error.message);
  }
}

async function scrapeRecentPost({ creator, userid, linkedAccountId }) {
  let page;
  try {
    const profileUrl = creator.url;
    const creatorid = creator._id;

    page = await browser.newPage();

    await page.goto(profileUrl, { waitUntil: "domcontentloaded" });

    await page.waitForSelector("div.feed-shared-update-list-carousel", { state: 'visible' });

    await page.evaluate(() => {
      document.querySelectorAll("div.feed-shared-update-list-carousel").forEach(feed => {
        const ul = feed.querySelector("ul");
        if (!ul) return;

        const commentBtn = ul.querySelector('li button[aria-label="Comment"]');
        if (commentBtn) commentBtn.click();
      });
    });

    await page.waitForSelector("main", { state: 'visible' });
    await page.waitForSelector("div.update-components-text.update-components-update-v2__commentary", { state: 'visible' });

    const postUrl = page.url();
    const existing = await CommentDetail.findOne({ userid, linkedAccountId, creatorid, postUrl });

    if (!existing) {
      console.log(`🆕 Saving new post for creator ${creatorid}`);
      await CommentDetail.create({ userid, linkedAccountId, creatorid, postUrl, status: 'pending' });


      await delay(2000);
    } else {
      console.log(`✅ Post already processed for creator ${creatorid}`);
    }

    // Update creator's lastScrapedAt individually
    await Creator.updateOne({ _id: creatorid }, { $set: { lastScrapedAt: new Date().toISOString() } });
  } catch (err) {
    console.error(`❌ Error processing creator ${creator._id}:`, err.message);
  } finally {
    if (page) await page.close();
  }
}

cron.schedule('* * * * *', async () => {
  // cron.schedule('*/5 9-18 * * *', async () => {
  console.log('Running cron job during allowed hours');
  // await cronJobToCommentRecentPostsFromDbMultiBrowser();
  // await cronJobToKeywordPostsFromDbMultiBrowser()
}, {
  timezone: "Asia/Karachi"
});

async function cronJobToCommentRecentPostsFromDbMultiBrowser() {
  try {
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(3); // max 3 tabs at once
    const postsData = await CommentDetail.find({ status: 'pending' });

    // Group by linkedAccountId
    const groupedByAccount = postsData.reduce((acc, post) => {
      const id = post.linkedAccountId;
      if (!acc[id]) acc[id] = [];
      acc[id].push(post);
      return acc;
    }, {});


    const jobs = Object.entries(groupedByAccount).map(([linkedAccountId, posts]) => limit(async () => {

      const firstPost = posts[0];
      console.log("🚀 ~ jobs ~ firstPost:", firstPost)
      const user = await User.findById(firstPost.userid);
      const linkedAccount = await LinkedAccount.findOne({ _id: linkedAccountId, cookieStatus: true });

      const packageDetail = await PackageDetail.findOne({
        toPlanId: user.packageid,
        userid: user._id,
      });

      // const linkedAccountId = userGroup[0][0]?.linkedAccountId;
      // const linkedAccount = await LinkedAccount.findById(linkedAccountId);
      // const userid = userGroup[0][0]?.userid
      // const user = await User.findById(userid);
      // const packageid = user?.packageid
      // const packageDetail = await PackageDetail.findOne({ toPlanId: packageid, userid })
      // const expDate = packageDetail?.expireDate

      const isExpired = new Date(packageDetail?.expireDate) < new Date();
      if (isExpired) {
        console.log(`⚠️ Skipping expired user: ${user.email}`);
        return;
      }

      const cookies = JSON.parse(linkedAccount?.cookie);
      const userAgent = linkedAccount?.userAgent;

      const userDir = path.resolve(__dirname, `../tmp/sessions-${linkedAccountId}`);
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });


      let browser, context, page;
      let headless = false;
      let args = ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'];

      context = await chromium.launchPersistentContext(userDir, {
        headless,
        args,
        userAgent,
        viewport: null,
        // proxy,
      });

      if (context.pages().length) {
        page = context.pages()[0];
      } else {
        page = await context.newPage();
      }
      // await page.setUserAgent(userAgent);
      page.setDefaultTimeout(60000); // changes default for all waits

      // --- Stealth Injection ---
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

        // Battery spoof
        navigator.getBattery = async () => ({
          charging: true,
          level: 1,
          chargingTime: 0,
          dischargingTime: Infinity
        });

        // Touch support
        navigator.maxTouchPoints = 1;

        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);

        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter) {
          if (parameter === 37445) return "Intel Inc.";
          if (parameter === 37446) return "Intel Iris OpenGL Engine";
          return getParameter.call(this, parameter);
        };

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const copy = audioContext.createAnalyser;
        audioContext.createAnalyser = function () {
          const analyser = copy.call(this);
          analyser.getFloatFrequencyData = function () { };
          return analyser;
        };
      });


      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });

      let isLoggedIn = await page.$('img.global-nav__me-photo');

      if (!isLoggedIn) {
        console.log(`🔐 Not logged in yet, trying cookie for ${user.email}`);

        const sanitizedCookies = cookies
          .filter(cookie => cookie.name && cookie.value && cookie.domain)
          .map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure !== undefined ? cookie.secure : true,
            httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : true,
            expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : undefined
          }));

        if (!sanitizedCookies.length) {
          throw new Error("No valid cookies found");
        }

        await context.clearCookies(); // prevent old login conflicts
        await context.addCookies(sanitizedCookies);

        await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
        isLoggedIn = await page.$('img.global-nav__me-photo');
      }

      if (!isLoggedIn) {
        console.log(`❌ Cookie failed for ${user.email}`);
        await LinkedAccount.findByIdAndUpdate(linkedAccountId, { cookieStatus: false });
        await context.close();
        return;
      }

      console.log(`✅ Logged in as ${user.email} using cookie`);

      // for (const linkedGroup of userGroup) {
      //   for (const post of linkedGroup) {
      // Loop through all posts for this linkedAccountId
      for (const post of posts) {
        const { postUrl, creatorid } = post;
        console.log(`📨 Navigating to: ${postUrl}`);

        try {
          // await delay(Math.floor(Math.random() * (15000 - 5000) + 5000));
          await page.goto(postUrl, { waitUntil: 'load' });
          await delay(2000);

          //   const commentButton = 'button.comments-comment-box__submit-button--cr';
          // const isDisabled = await page.$eval(commentButton, el => el.hasAttribute('disabled'));
          // if (isDisabled) {
          //   console.log('🚫 Comment button is disabled.');
          //   await context.close();
          // }

          const postContentExists = await page.$("div.update-components-text.update-components-update-v2__commentary");
          if (!postContentExists) {
            await CommentDetail.updateOne({ postUrl }, {
              $set: { comment: 'Post inaccessible or deleted', status: 'commented' }
            });
            continue;
          }

          const { postData, postAuthor } = await page.evaluate(() => ({
            postData: document.querySelector("div.update-components-text.update-components-update-v2__commentary")?.textContent.trim() || "No post found",
            postAuthor: document.querySelector(".update-components-actor__title span[aria-hidden='true']")?.textContent.trim() || "Author not found",
          }));

          // console.log("📄 PostData:", postData);
          // console.log("👤 Author:", postAuthor);

          // Load comment settings and tone
          const commentSetting = await CommentSetting.findOne({ creatorid, linkedAccountId }) ??
            await CommentSetting.findOne({ creatorid: "0", linkedAccountId });

          // const tone = await LinkedAccountTone.findOne({ linkedAccountId });

          const enabledCommentSettings = ["emoji", "hashtag", "exclamation", "author"]
            .filter(s => commentSetting?.[s]);

          const linkedAccountTone = await LinkedAccountTone.findOne({ linkedAccountId });
          const { commentsLength, formalityLevel, personality, questionsFrequency, tone, gender } = linkedAccountTone || {};

          const settingRules = {
            emoji: "Turn on emojis and use 1 or 2.",
            hashtag: "Turn on hashtags and use 1 or 2.",
            exclamation: "Use exclamation marks where necessary.",
            author: "Tag the post author.",
          };

          const toneRules = {
            commentsLength: commentsLength && `Keep comments about ${commentsLength} characters long.`,
            formalityLevel: formalityLevel && `Use a ${formalityLevel} tone.`,
            personality: personality && `Reflect a ${personality} personality.`,
            questionsFrequency: questionsFrequency && `Include questions with a frequency of ${questionsFrequency}.`,
            tone: tone && `Use a ${tone} tone.`,
            gender: gender && `Consider me as a ${gender}.`
          };

          let rules = "Write a human-like comment and follow the rules below:\n Keep under 200 characters";

          let index = 1;
          enabledCommentSettings.forEach(setting => {
            if (settingRules[setting]) {
              rules += `\n${index++}. ${settingRules[setting]}`;
            }
          });
          Object.values(toneRules).forEach(rule => {
            if (rule) {
              rules += `\n${index++}. ${rule}`;
            }
          });

          rules +=
            `\nsome examples of real humans comment below


              "I would like to see what you "bro-ing out" on us would look like. 
              -------
              I do wonder if teleportation will ever be a thing.
              Morning sprint + Posting spring + Evening sprint.
              -------
              3 times I log in daily. And it's more than enough!
              "You can’t outgrow the limits of your own self-perception"
              -------
              OK, WOW. 🔥
              ...
              Post Author = "${postAuthor}"
              Post Content
              "${postData}"
              `;

          console.log("rules:", rules);

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: rules,
          });

          const commentText = response?.text
          console.log("🚀 ~ jobs ~ commentText:", commentText)

          const commentBox = 'div.ql-editor[contenteditable="true"]';
          const commentButton = 'button.comments-comment-box__submit-button--cr';

          const shouldMentionAuthor = enabledCommentSettings.includes('author');

          if (!shouldMentionAuthor) {
            // 🔹 Post simple comment without mention
            await page.waitForSelector(commentBox, { state: 'visible' });
            await page.click(commentBox);
            await page.type(commentBox, commentText);
            await page.waitForSelector(commentButton, { state: 'visible' });
            await page.click(commentButton);
          } else {
            // 🔹 Try to detect and mention author in the comment
            const mentionRegex = /@(?:[A-Za-z0-9.\-]+(?:\s+[A-Za-z0-9.\-]+){0,9})/;
            const mentionMatch = commentText.match(mentionRegex);
            let beforeMention = commentText;
            let mentionTrigger = "";
            let afterMention = "";
            if (mentionMatch) {
              const fullMention = mentionMatch[0]; // e.g., "@Ravi Kumar"
              const mentionIndex = commentText.indexOf(fullMention);

              beforeMention = commentText.slice(0, mentionIndex);
              mentionTrigger = fullMention; // use full name trigger
              afterMention = commentText.slice(mentionIndex + fullMention.length);
            }
            // 1. Focus the comment box
            await page.waitForSelector(commentBox, { state: 'visible' });
            const commentBoxHandle = await page.$(commentBox);
            await commentBoxHandle.click();
            // 2. Type only up to @mention
            await page.keyboard.type(beforeMention);
            // 3. Type the full @mention (e.g., @Ravi Kumar)
            await page.keyboard.type(mentionTrigger);
            // 4. Wait for LinkedIn dropdown
            await page.waitForTimeout(1500);
            // 5. Move mouse to dropdown suggestion and click
            const box = await commentBoxHandle.boundingBox();
            if (box) {
              const x = box.x + box.width / 2;
              const y = box.y + box.height + 25; // slightly lower for dropdown
              await page.mouse.move(x, y);
              await page.mouse.click(x, y);
              await page.waitForTimeout(500); // wait for mention to be inserted
            }
            // 6. Type the rest of the comment
            await page.keyboard.type(afterMention);
            // 7. Click comment button
            await page.waitForSelector(commentButton, { state: 'visible' });
            await page.click(commentButton);
            console.log("✅ Comment posted with full name mention.");
          }
          console.log("✅ Comment posted");
          await CommentDetail.updateOne({ postUrl }, { $set: { comment: commentText, status: 'commented' } });

          await delay(3000);
        } catch (e) {
          console.error("❌ Error on post:", postUrl, e.message);
        }
      }
      // }

      await context.close();
    }));

    await Promise.all(jobs);
  } catch (err) {
    console.error("❌ Error in cron job:", err);
  }
}

function isEligibleToComment(lastScrapedAt, keywordLimit) {
  const now = new Date();
  const today9AM = new Date(now);
  today9AM.setHours(9, 0, 0, 0);

  const today6PM = new Date(now);
  today6PM.setHours(18, 0, 0, 0);

  if (now < today9AM || now > today6PM) {
    return false; // outside allowed time window
  }

  const totalIntervalMs = today6PM - today9AM;
  const intervalPerComment = totalIntervalMs / keywordLimit;

  const intervalsSinceStart = Math.floor((now - today9AM) / intervalPerComment);

  const lastScrape = new Date(lastScrapedAt);
  const intervalsSinceLastScrape = Math.floor((lastScrape - today9AM) / intervalPerComment);

  return intervalsSinceStart > intervalsSinceLastScrape;
}


async function cronJobToKeywordPostsFromDbMultiBrowser() {
  try {
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(3); // max 3 tabs at once

    let linkedAccounts = await LinkedAccount.find({ status: "active", cookieStatus: true }).lean()

    for (let i = linkedAccounts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [linkedAccounts[i], linkedAccounts[j]] = [linkedAccounts[j], linkedAccounts[i]];
    }

    const jobs = [];

    for (const linkedAccount of linkedAccounts) {
      jobs.push(limit(async () => {
        let context;
        try {
          const linkedAccountId = linkedAccount?._id;
          const userid = linkedAccount?.userid
          const user = await User.findById(userid);
          const packageid = user?.packageid
          const package = await Package.findOne({ _id: packageid })
          const packageDetail = await PackageDetail.findOne({ toPlanId: packageid, userid })
          const expDate = packageDetail?.expireDate

          const expireDate = new Date(expDate);
          const now = new Date();
          const isExpired = expireDate < now;

          if (isExpired == true) {
            return
          }

          const { commentLimit, keywordLimit } = package || {};

          const keywordTag = await Keyword.findOne({ linkedAccountId, status: "active" })

          const lastScrapedAt = keywordTag?.lastScrapedAt;

          if (!isEligibleToComment(lastScrapedAt, keywordLimit)) {
            console.log(`⏳ Waiting for next interval. Last scrape: ${lastScrapedAt}`);
            return;
          }

          const cookies = JSON.parse(linkedAccount?.cookie);
          const userAgent = linkedAccount?.userAgent;

          const userDir = path.resolve(__dirname, `../tmp/sessions-${linkedAccountId}`);
          if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

          let page;
          let headless = false;
          let args = ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'];

          context = await chromium.launchPersistentContext(userDir, {
            headless,
            args,
            userAgent,
            viewport: null,
            // proxy,
          });

          if (context.pages().length) {
            page = context.pages()[0];
          } else {
            page = await context.newPage();
          }
          // await page.setUserAgent(userAgent);
          // page.setDefaultTimeout(60000); // changes default for all waits

          // --- Stealth Injection ---
          await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

            // Battery spoof
            navigator.getBattery = async () => ({
              charging: true,
              level: 1,
              chargingTime: 0,
              dischargingTime: Infinity
            });

            // Touch support
            navigator.maxTouchPoints = 1;

            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
              parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters);

            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
              if (parameter === 37445) return "Intel Inc.";
              if (parameter === 37446) return "Intel Iris OpenGL Engine";
              return getParameter.call(this, parameter);
            };

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const copy = audioContext.createAnalyser;
            audioContext.createAnalyser = function () {
              const analyser = copy.call(this);
              analyser.getFloatFrequencyData = function () { };
              return analyser;
            };
          });


          await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });

          let isLoggedIn = await page.$('img.global-nav__me-photo');

          if (!isLoggedIn) {
            console.log(`🔐 Not logged in yet, trying cookie for ${user.email}`);

            const sanitizedCookies = cookies
              .filter(cookie => cookie.name && cookie.value && cookie.domain)
              .map(cookie => ({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: cookie.secure !== undefined ? cookie.secure : true,
                httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : true,
                expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : undefined
              }));

            if (!sanitizedCookies.length) {
              throw new Error("No valid cookies found");
            }

            await context.clearCookies(); // prevent old login conflicts
            await context.addCookies(sanitizedCookies);

            await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);
            isLoggedIn = await page.$('img.global-nav__me-photo');
          }

          if (!isLoggedIn) {
            console.log(`❌ Cookie failed for ${user.email}`);
            await LinkedAccount.findByIdAndUpdate(linkedAccountId, { cookieStatus: false });
            await context.close();
            return;
          }

          console.log(`✅ Logged in as ${user.email} using cookie`);


          try {

            if (!keywordTag.keyword || keywordTag.keyword.length === 0) {
              return
            }
            // Split the first string in the array into separate keywords
            const keywords = keywordTag.keyword[0].split(',');

            // Pick a random keyword
            let randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];

            console.log("Random Keyword:", randomKeyword);

            // const inputSelector = 'input.search-global-typeahead__input';
            // const commentBoxSelector = 'div.ql-editor[contenteditable="true"]';
            // const commentButtonSelector = 'button.comments-comment-box__submit-button--cr';

            const encodedKeyword = encodeURIComponent(randomKeyword);
            const keywordUrl = `https://www.linkedin.com/search/results/content/?datePosted=%22past-24h%22&keywords=${encodedKeyword}&origin=FACETED_SEARCH&sortBy=%22relevance%22`;

            await page.goto(keywordUrl, { waitUntil: 'networkidle' });

            // Wait for posts to load
            await page.waitForSelector('main', { visible: true });
            await page.waitForSelector('ul[role="list"] li.artdeco-card', { visible: true });

            const urns = await page.$$eval('ul[role="list"] li', listItems =>
              listItems.map(li => {
                const el = li.querySelector('[data-urn]');
                return el?.getAttribute('data-urn') || null;
              }).filter(Boolean)
            );

            console.log('Scoped URNs:', urns[0]);

            const postUrl = `https://www.linkedin.com/feed/update/${urns[0]}`
            console.log("postUrl", postUrl)

            const isPostUrlDone = await CommentDetail.findOne({ postUrl })
            if (isPostUrlDone) {
              console.log("Comment Already done")
              return
            }

            await page.goto(postUrl, { waitUntil: 'load' });
            await delay(2000);

            const postContentExists = await page.$("div.update-components-text.update-components-update-v2__commentary");
            if (!postContentExists) {
              await CommentDetail.updateOne({ postUrl }, {
                $set: { comment: 'Post inaccessible or deleted', status: 'commented' }
              });
              return;
            }

            const { postData, postAuthor } = await page.evaluate(() => ({
              postData: document.querySelector("div.update-components-text.update-components-update-v2__commentary")?.textContent.trim() || "No post found",
              postAuthor: document.querySelector(".update-components-actor__title span[aria-hidden='true']")?.textContent.trim() || "Author not found",
            }));

            console.log("📄 PostData:", postData);
            console.log("👤 Author:", postAuthor);

            // const isDisabled = await page.$eval(commentButton, el => el.hasAttribute('disabled'));
            // if (isDisabled) {
            //   console.log('🚫 Comment button is disabled.');
            //   await context.close();
            // }

            // Load comment settings and tone
            const commentSetting = await CommentSetting.findOne({ linkedAccountId, keywordid: '0' })

            const enabledCommentSettings = ["emoji", "hashtag", "exclamation", "author"]
              .filter(s => commentSetting?.[s]);

            const linkedAccountTone = await LinkedAccountTone.findOne({ linkedAccountId });
            const { commentsLength, formalityLevel, personality, questionsFrequency, tone, gender } = linkedAccountTone || {};

            const settingRules = {
              emoji: "Turn on emojis and use 1 or 2.",
              hashtag: "Turn on hashtags and use 1 or 2.",
              exclamation: "Use exclamation marks where necessary.",
              author: "Tag the post author.",
            };

            const toneRules = {
              commentsLength: commentsLength && `Keep comments about ${commentsLength} characters long.`,
              formalityLevel: formalityLevel && `Use a ${formalityLevel} tone.`,
              personality: personality && `Reflect a ${personality} personality.`,
              questionsFrequency: questionsFrequency && `Include questions with a frequency of ${questionsFrequency}.`,
              tone: tone && `Use a ${tone} tone.`,
              gender: gender && `Consider me as a ${gender}.`
            };

            let rules = "Write a human-like comment and follow the rules below:\n Keep under 200 characters";

            let index = 1;
            enabledCommentSettings.forEach(setting => {
              if (settingRules[setting]) {
                rules += `\n${index++}. ${settingRules[setting]}`;
              }
            });
            Object.values(toneRules).forEach(rule => {
              if (rule) {
                rules += `\n${index++}. ${rule}`;
              }
            });

            rules +=
              `\nsome examples of real humans comment below


              "I would like to see what you "bro-ing out" on us would look like. 
              -------
              I do wonder if teleportation will ever be a thing.
              Morning sprint + Posting spring + Evening sprint.
              -------
              3 times I log in daily. And it's more than enough!
              "You can’t outgrow the limits of your own self-perception"
              -------
              OK, WOW. 🔥
              ...
              Post Author = "${postAuthor}"
              Post Content
              "${postData}"
              `;

            console.log("rules:", rules);

            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: rules,
            });

            const commentText = response?.text
            console.log("🚀 ~ jobs ~ commentText:", commentText)

            const commentBox = 'div.ql-editor[contenteditable="true"]';
            const commentButton = 'button.comments-comment-box__submit-button--cr';

            const shouldMentionAuthor = enabledCommentSettings.includes('author');

            if (!shouldMentionAuthor) {
              // 🔹 Post simple comment without mention
              await page.waitForSelector(commentBox, { state: 'visible' });
              await page.click(commentBox);
              await page.type(commentBox, commentText);
              await page.waitForSelector(commentButton, { state: 'visible' });
              await page.click(commentButton);
            } else {
              // 🔹 Try to detect and mention author in the comment
              const mentionRegex = /@(?:[A-Za-z0-9.\-]+(?:\s+[A-Za-z0-9.\-]+){0,9})/;
              const mentionMatch = commentText.match(mentionRegex);
              let beforeMention = commentText;
              let mentionTrigger = "";
              let afterMention = "";
              if (mentionMatch) {
                const fullMention = mentionMatch[0]; // e.g., "@Ravi Kumar"
                const mentionIndex = commentText.indexOf(fullMention);

                beforeMention = commentText.slice(0, mentionIndex);
                mentionTrigger = fullMention; // use full name trigger
                afterMention = commentText.slice(mentionIndex + fullMention.length);
              }
              // 1. Focus the comment box
              await page.waitForSelector(commentBox, { state: 'visible' });
              const commentBoxHandle = await page.$(commentBox);
              await commentBoxHandle.click();
              // 2. Type only up to @mention
              await page.keyboard.type(beforeMention);
              // 3. Type the full @mention (e.g., @Ravi Kumar)
              await page.keyboard.type(mentionTrigger);
              // 4. Wait for LinkedIn dropdown
              await page.waitForTimeout(1500);
              // 5. Move mouse to dropdown suggestion and click
              const box = await commentBoxHandle.boundingBox();
              if (box) {
                const x = box.x + box.width / 2;
                const y = box.y + box.height + 25; // slightly lower for dropdown
                await page.mouse.move(x, y);
                await page.mouse.click(x, y);
                await page.waitForTimeout(500); // wait for mention to be inserted
              }
              // 6. Type the rest of the comment
              await page.keyboard.type(afterMention);
              // 7. Click comment button
              await page.waitForSelector(commentButton, { state: 'visible' });
              await page.click(commentButton);
              console.log("✅ Comment posted with full name mention.");
            }
            console.log("✅ Comment posted");
            // await CommentDetail.updateOne({ postUrl }, { $set: { comment: commentText, status: 'commented' } });
            await CommentDetail.create({ userid, postUrl, comment: commentText, status: 'commented', keywordid: keywordTag?._id });
            await Keyword.updateOne({ _id: keywordTag?._id }, { $set: { lastScrapedAt: new Date().toISOString() } });

            await delay(3000);
          } catch (e) {
            console.error("❌ Error on post:", e);
          }

        } catch (err) {
          console.error("Error in cron job limit:", err);
        } finally {
          if (context) {
            await context.close();
          }
        }
      }));
    }

    await Promise.all(jobs);
  } catch (err) {
    console.error("❌ Error in cron job:", err);
  }
}

(module.exports = router), browser, { page };
