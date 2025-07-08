const express = require('express');
const { CleanHTMLData, CleanDBData, generateRandomCode } = require('../config/sanitization');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LinkedAccount = require('../models/LinkedAccount');
const CommentSetting = require('../models/CommentSetting');
const { backendURL } = require('../config/sanitization');
const LinkedAccountTone = require('../models/LinkedAccountTone');
const puppeteer = require("puppeteer");
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());
const { chromium } = require('playwright');
const { saveHar } = require('playwright-har');
const path = require('path');
const fs = require('fs');

// function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms))}

async function simulateHumanBehavior(page) {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Move mouse randomly
    for (let i = 0; i < 5; i++) {
        await page.mouse.move(
            Math.random() * 800,
            Math.random() * 600,
            { steps: 10 }
        );
        await delay(300 + Math.random() * 500);
    }

    // Scroll down slowly
    for (let i = 0; i < 5; i++) {
        await page.mouse.wheel({ deltaY: 200 + Math.random() * 100 });
        await delay(500 + Math.random() * 500);
    }

    // Random click somewhere
    await page.mouse.click(200 + Math.random() * 300, 100 + Math.random() * 300);
    await delay(500);
}

router.post('/cookiesData', async (req, res) => {
    const postData = req.body;
    console.log("🚀 ~ router.post ~ postData:", postData)
    const cookies = JSON.parse(postData.cookies);
    const userAgent = postData.userAgent;
    const token = CleanHTMLData(CleanDBData(postData.token));

    try {
        const decoded = jwt.decode(token);
        const userid = decoded.id;
        const user = await User.findOne({ _id: userid })

        console.log("🚀 ~ router.post ~ user:", user)

        // const userDir = path.resolve(__dirname, `../tmp/sessions-${userid}`);
        const harPath = path.resolve(__dirname, `./tmp/linkedin-${userid}.har`);

        let browser, context, page;
        let headless = false;
        let args = ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'];

        // if (user?.packageid !== "6861212a2c4bae8a961b00e0") {
        //     // Persistent context (returns context directly)
        //     context = await chromium.launchPersistentContext(userDir, {
        //         headless,
        //         args,
        //         // proxy,
        //     });

        //      if (context.pages().length) {
        //         page = context.pages()[0];
        //     } else {
        //         page = await context.newPage();
        //     }
        //     await page.setUserAgent(userAgent);
        // } else {
            // Regular launch, then create context manually
            browser = await chromium.launch({
                headless,
                args,
                // proxy,
            });

            context = await browser.newContext({
                userAgent,
                viewport: null,
            });
            page = await context.newPage();
        // }

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

        // Set cookies
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

        if (!sanitizedCookies.length) throw new Error("No valid cookies found");

        await context.addCookies(sanitizedCookies);

        // Enable HAR recording
        // const har = await saveHar(context, harPath);

        // const page = await context.newPage();

        // Simulate human-like behavior
        // await simulateHumanBehavior(page);
        
        // --- Page Actions ---
        await page.goto("https://www.linkedin.com/feed/", { waitUntil: 'domcontentloaded' });

        let pageData;
        const hasCompanySection = await page.$(".org-organization-admin-pages-entrypoint-card__item");
        if (hasCompanySection) {
            pageData = await page.evaluate(() => {
                let companies = [];
                document.querySelectorAll(".org-organization-admin-pages-entrypoint-card__item").forEach((item) => {
                    let name = item.querySelector("span.text-body-xsmall-bold.t-black")?.innerText.trim();
                    let url = item.querySelector("a")?.getAttribute("href");
                    let imgUrl = item.querySelector("img")?.getAttribute("src");

                    if (name && url) {
                        companies.push({ name, url: `https://www.linkedin.com${url}`, imgUrl });
                    }
                });
                return companies.length > 0 ? JSON.stringify(companies) : "No company found";
            });
        } else {
            pageData = "No company found";
        }

        await page.goto("https://www.linkedin.com/in/me/", { waitUntil: 'domcontentloaded' });

        const htmlSelector = "img.evi-image.ember-view.profile-photo-edit__preview";
        const nameSelector = "h1.inline.t-24.v-align-middle.break-words";
        const tagLineSelector = '.text-body-medium.break-words[data-generated-suggestion-target]';
        const urlSelector = 'p.t-14.t-normal.t-black--light.pt1.break-words';

        await page.waitForSelector(nameSelector);
        await page.waitForSelector(urlSelector);

        const ProfileData = await page.evaluate(({ htmlSelector, nameSelector, tagLineSelector, urlSelector }) => {
            const imageUrl = document.querySelector(htmlSelector)?.src || 'user.png';
            const name = document.querySelector(nameSelector)?.innerText.trim() || 'No Name found';
            const tagLine = document.querySelector(tagLineSelector)?.innerText.trim() || 'No Tag Line found';
            const profileLink = document.querySelector(urlSelector)?.innerText.trim() || 'No Profile Link found';
            return { imageUrl, name, tagLine, profileLink };
        }, { htmlSelector, nameSelector, tagLineSelector, urlSelector });

        console.log("ProfileData", ProfileData)

        await page.goto("https://www.linkedin.com/public-profile/settings", { waitUntil: 'domcontentloaded' });

        // Wait for the input field to be available
        await page.waitForSelector('input.vanity-name__input-box');
        const vanityName = await page.$eval('input.vanity-name__input-box', input => input.value);
        const realProfileUrl = `www.linkedin.com/in/${vanityName}`;

        console.log('Custom Profile URL:', realProfileUrl);

        const Linkacc = await LinkedAccount.findOneAndUpdate(
            { userid: userid, url: realProfileUrl },
            {
                name: ProfileData?.name,
                imageUrl: ProfileData?.imageUrl,
                tagLine: ProfileData?.tagLine,
                pageData: pageData,
                status: 'active',
                cookie: JSON.stringify(cookies),
                userAgent
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await CommentSetting.findOneAndUpdate(
            { linkedAccountId: Linkacc?._id },
            {
                creatorid: "0", emoji: false, hashtag: false,
                exclamation: false, author: false, status: true
            },
            { upsert: true, new: true, }
        );

        await LinkedAccountTone.findOneAndUpdate(
            { linkedAccountId: Linkacc?._id },
            {
                userid, tone: "friendly", formalityLevel: "semiFormal",
                questionsFrequency: "never", commentsLength: "medium", personality: "optimistic",
            },
            { upsert: true, new: true, }
        );

        // await har.stop();
        if (browser) await browser.close();

        res.json({
            status: "success",
            message: `Cookie data collected`,
        });

    } catch (err) {
        console.error(err);
        res.json({
            status: "error",
            message: "Something went wrong",
        });
    }
});



// router.post('/cookiesData', async (req, res) => {
//     const postData = req.body;
//     console.log("🚀 ~ router.post ~ postData:", postData);
//     let cookies = postData.cookies;
//     const token = CleanHTMLData(CleanDBData(postData.token));

//     try {
//         const decoded = jwt.decode(token);
//         const userid = decoded.id;
//         console.log("🚀 ~ router.post ~ userid:", userid)

//         let browser = await puppeteer.launch({
//             headless: false,
//             args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
//             defaultViewport: null,
//         });

//         let page = await browser.newPage();
//         await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36");

//         await page.setDefaultNavigationTimeout(60000);

//         await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded' });

//         const sanitizedCookies = cookies
//         .filter(cookie => cookie.name && cookie.value && cookie.domain)
//         .map(cookie => ({
//             ...cookie,
//                 path: cookie.path || '/',
//                 secure: cookie.secure !== undefined ? cookie.secure : true,
//                 httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : true,
//                 expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : undefined
//             }));

//             if (sanitizedCookies.length === 0) {
//                 throw new Error("No valid cookies found");
//             }

//         console.log("🚀 ~ router.post ~ sanitizedCookies:", ...sanitizedCookies)
//         await page.setCookie(...sanitizedCookies);

//         console.log("Cookie set successfully. in extension route");

//         await page.goto("https://www.linkedin.com/in/me/", { waitUntil: 'domcontentloaded' });

//         console.log("Cookie set successfully. in extension route");

//         const htmlSelector = "img.evi-image.ember-view.profile-photo-edit__preview"; // Profile image
//         const nameSelector = "h1.inline.t-24.v-align-middle.break-words"; // Name
//         const tagLineSelector = '.text-body-medium.break-words[data-generated-suggestion-target]'; // Tagline
//         const urlSelector = 'p.t-14.t-normal.t-black--light.pt1.break-words'; // Profile Url

//         // await page.waitForSelector(htmlSelector);
//         await page.waitForSelector(nameSelector);
//         // await page.waitForSelector(tagLineSelector);
//         await page.waitForSelector(urlSelector);

//         const ProfileData = await page.evaluate((htmlSelector, nameSelector, tagLineSelector, urlSelector) => {
//             const imageUrl = document.querySelector(htmlSelector)?.src || 'No image found';
//             const name = document.querySelector(nameSelector)?.innerText.trim() || 'No Name found';
//             const tagLine = document.querySelector(tagLineSelector)?.innerText.trim() || 'No Tag Line found';
//             const profileLink = document.querySelector(urlSelector)?.innerText.trim() || 'No Profile Link found';
//             return { imageUrl, name, tagLine, profileLink };
//         }, htmlSelector, nameSelector, tagLineSelector, urlSelector);

//         console.log('Profile Data:', ProfileData);

//         await page.goto("https://www.linkedin.com/feed/", { waitUntil: 'domcontentloaded' });

//         // Check if the company section exists before waiting
//         const hasCompanySection = await page.$(".org-organization-admin-pages-entrypoint-card__item");

//         let pageData;
//         if (hasCompanySection) {
//             // Extract company names and URLs
//             pageData = await page.evaluate(() => {
//                 let companies = [];
//                 document.querySelectorAll(".org-organization-admin-pages-entrypoint-card__item").forEach((item) => {
//                     let name = item.querySelector("span.text-body-xsmall-bold.t-black")?.innerText.trim();
//                     let url = item.querySelector("a")?.getAttribute("href");
//                     let imgUrl = item.querySelector("img")?.getAttribute("src");

//                     if (name && url) {
//                         companies.push({ name, url: `https://www.linkedin.com${url}`, imgUrl });
//                     }
//                 });
//                 return companies.length > 0 ? JSON.stringify(companies) : "No company found";
//             });
//         } else {
//             pageData = "No company found";
//         }
//         console.log('Page Data:', pageData);

//         await LinkedAccount.findOneAndUpdate(
//             { userid: userid, url: ProfileData?.profileLink }, // Search criteria
//             {
//                 name: ProfileData?.name,
//                 imageUrl: ProfileData?.imageUrl,
//                 tagLine: ProfileData?.tagLine,
//                 pageData: pageData,
//                 status: 'active',
//                 cookie,
//                 // extensionStatus: true,
//                 // cookieStatus: true
//             },
//             { upsert: true, new: true }
//         );

//         await browser.close();

//         res.json({
//             status: "success",
//             message: `get cookie data`,
//         });
//     } catch (err) {
//         console.error(err);
//         res.json({
//             status: "error",
//             message: "Something went wrong",
//         });
//     }
// });


// router.post('/extensionInstallStatus', async (req, res) => {
//     const postData = req.body;
//     console.log("🚀 ~ router.post ~ postData:", postData)
//     const token = CleanHTMLData(CleanDBData(postData.token));

//     try {
//         if (postData.token) {

//             const userid = jwt.decode(token);
//             console.log("🚀 ~ router.post ~ userid:", userid)
//             const verified = jwt.verify(token, process.env.JWT_SECRET);
//             console.log("🚀 ~ router.post ~ verified:", verified)

//             res.json({
//                 status: "success",
//                 message: "Extension added",
//                 extensionStatus: true,
//                 userid:userid?.id
//             });
//         }


//     } catch (err) {
//         console.error(err);
//         res.json({
//             status: "error",
//             message: "Something want wrong",
//         });
//     }
// });

// router.post('/loginDetail', async (req, res) => {
//     const postData = req.body;
//     console.log("🚀 ~ router.post ~ postData:", postData)
//     const token = CleanHTMLData(CleanDBData(postData.token));
//     const password = CleanHTMLData(CleanDBData(postData.password));
//     const email = CleanHTMLData(CleanDBData(postData.email));

//     try {
//         const decoded = jwt.decode(token);
//         const userid = decoded.id;

//         await User.findOneAndUpdate(
//             { _id: userid },
//             { cookieStatus: true, extensionStatus: true },
//             { new: true, upsert: true }
//         );

//         const browser = await puppeteer.launch({
//             // headless: 'new', // Use 'new' for better performance
//             headless: false,
//             args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
//             defaultViewport: null,
//         });

//         const page = await browser.newPage();

//         await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36");

//         // await page.setViewport({ width: 1280, height: 800 });
//         await page.setDefaultNavigationTimeout(60000);

//         // Navigate directly to LinkedIn Login page
//         await page.goto("https://www.linkedin.com/login", { waitUntil: 'domcontentloaded' });

//         // Fill the login form
//         await page.type('input[name="session_key"]', email, { delay: 100 });
//         await page.type('input[name="session_password"]', password, { delay: 100 });

//         await page.click('button[type="submit"]');


//         // Check if company section exists (faster check using `evaluate`)
//         // await page.goto("https://www.linkedin.com/feed/", { waitUntil: 'domcontentloaded' });

//         const companySelector = ".org-organization-admin-pages-entrypoint-card__item";
//         const nameSelector = "span.text-body-xsmall-bold.t-black";
//         const urlSelector = "a";
//         const imgSelector = "img";

//         const pageData = await page.evaluate((companySelector, nameSelector, urlSelector, imgSelector) => {
//             let companies = [];
//             document.querySelectorAll(companySelector).forEach((item) => {
//                 let name = item.querySelector(nameSelector)?.innerText.trim();
//                 let url = item.querySelector(urlSelector)?.getAttribute("href");
//                 let imgUrl = item.querySelector(imgSelector)?.getAttribute("src");

//                 if (name && url) {
//                     companies.push({ _id: url.match(/company\/(\d+)/)?.[1], name, url: `https://www.linkedin.com${url}`, imgUrl, status: false, });
//                 }
//             });

//             return companies.length > 0 ? JSON.stringify(companies) : "No company found";
//         },
//             companySelector, nameSelector, urlSelector, imgSelector
//         );

//         console.log("🏢 Company Data:", pageData);

//         // Navigate directly to LinkedIn profile
//         await page.goto("https://www.linkedin.com/in/me/", { waitUntil: 'domcontentloaded' });

//         // Extract profile data using faster parallel fetching
//         const profileData = await page.evaluate(() => {
//             return {
//                 imageUrl: document.querySelector("img.evi-image.ember-view.profile-photo-edit__preview")?.src || 'user.png',
//                 name: document.querySelector("h1.inline.t-24.v-align-middle.break-words")?.innerText.trim() || 'No Name found',
//                 tagLine: document.querySelector('.text-body-medium.break-words[data-generated-suggestion-target]')?.innerText.trim() || 'No Tag Line found',
//                 profileLink: document.querySelector('p.t-14.t-normal.t-black--light.pt1.break-words')?.innerText.trim() || 'No Profile Link found',
//             };
//         },);

//         console.log("🔹 Profile Data:", profileData);

//         const Linkacc = await LinkedAccount.findOneAndUpdate(
//             { userid: userid, url: profileData?.profileLink },
//             { name: profileData?.name, imageUrl: profileData?.imageUrl, tagLine: profileData?.tagLine, pageData, status: 'active', cookie: JSON.stringify({ email, password }) },
//             { upsert: true, new: true, setDefaultsOnInsert: true }
//         );

//         // Use findOneAndUpdate to either update or create a CommentSetting
//         await CommentSetting.findOneAndUpdate(
//             { linkedAccountId: Linkacc?._id },
//             {
//                 creatorid: "0", emojis: false, hashtag: false, lowercase: false,
//                 exclamation: false, author: false, status: true
//             },
//             { upsert: true, new: true, }
//         );

//         await LinkedAccountTone.findOneAndUpdate(
//             { linkedAccountId: Linkacc?._id },
//             {
//                 userid, tone: "friendly", formalityLevel: "semiFormal",
//                 questionsFrequency: "sometimes", commentsLength: "medium", personality: "optimistic",
//             },
//             { upsert: true, new: true, }
//         );

//         if (pageData !== "No company found") {
//             const linkedAccountPageUrlId = JSON.parse(pageData).map(item => item._id);

//             for (const element of linkedAccountPageUrlId) {
//                 const id = element
//                 await LinkedAccountTone.findOneAndUpdate(
//                     { linkedAccountPageId: id },
//                     {
//                         userid, tone: "friendly", formalityLevel: "semiFormal", linkedAccountId: Linkacc?._id,
//                         questionsFrequency: "sometimes", commentsLength: "medium", personality: "optimistic",
//                     },
//                     { upsert: true, new: true, }
//                 );
//             }
//         }

//         await browser.close(); // Close only the page, keep browser open

//         res.json({ status: "success", message: "Fetched LinkedIn data" });
//     } catch (err) {
//         console.error(err);
//         res.json({
//             status: "error",
//             message: "Something want wrong",
//         });
//     }
// });



module.exports = router;
