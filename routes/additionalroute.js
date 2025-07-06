
router.post("/cronjobForCreator", async (req, res) => {
  const postData = req.body;
  const creatorid = CleanHTMLData(CleanDBData(postData.creatorId));

  try {
    const users = await User.find({ role: { $ne: 'admin' } })
    console.log("🚀 ~ router.post ~ users:", users);
    for (const user of users) {
      const userid = user._id.toString();
      const creators = await Creator.find({ userid: userid, status: "active" });
      console.log("🚀 ~ router.post ~ creators:", creators);
      for (const creator of creators) {
        const profileUrl = creator.url;
        const profileId = creator._id;
        // const profileName = creator.name
        // console.log("🚀 ~ router.post ~ profileName:", profileName)
        // console.log("🚀 ~ router.post ~ profileUrl:", profileUrl)

        await page.goto(profileUrl, { waitUntil: "load", timeout: 60000 });
        // find the recent post and click on the comment button and open new page
        await page.waitForSelector("div.feed-shared-update-list-carousel");
        await page.evaluate(() => {
          document
            .querySelectorAll("div.feed-shared-update-list-carousel")
            .forEach((feedUpdate) => {
              const ulTag = feedUpdate.querySelector("ul");
              if (!ulTag) return;

              const commentButton = ulTag.querySelector(
                'li button[aria-label="Comment"]'
              );
              if (commentButton) commentButton.click();
            });
        });
        // find the comment input box and type the comment
        await page.waitForSelector("main");
        await page.waitForSelector(
          "div.update-components-text.update-components-update-v2__commentary"
        );

        const postData = await page.evaluate(() => {
          // Select the first matching element
          return (
            document
              .querySelector(
                "div.update-components-text.update-components-update-v2__commentary"
              )
              .textContent.trim() || "No post found"
          );
        });
        console.log("🚀 ~ PostData:", postData);

        const postUrl = page.url(); // Get the current URL
        console.log("Post URL:", postUrl);

        const checkPostUrl = await CommentDetail.findOne({
          userid,
          creatorid: profileId,
          postUrl,
        });
        console.log("🚀 ~ router.post ~ checkPostUrl:", checkPostUrl);

        if (checkPostUrl === null) {
          console.log("previous commented not found");

          let commentSetting = await CommentSetting.findOne({
            creatorid: profileId,
          });
          if (commentSetting === null) {
            commentSetting = await CommentSetting.findOne({ creatorid: "0" });
          }
          // console.log("🚀 ~ router.post ~ commentSetting:", commentSetting)

          // Find and log the settings that are true
          const trueSettings = [
            "emojis",
            "hashtag",
            "lowercase",
            "exclamation",
          ].filter((setting) => commentSetting[setting] === true);

          if (trueSettings.length > 0) {
            console.log(
              `The settings with true values are: ${trueSettings.join(", ")}`
            );
          } else {
            console.log("No setting is true.");
          }

          let rules = `Generate a comment for this post: "${postData}"
					*Rules:*
					- Less than 200 characters`;

          const settingRules = {
            emojis: "Use emojis",
            hashtag: "Use hashtags",
            lowercase: "Use lowercase letters",
            exclamation: "Use exclamation marks!",
          };

          // Loop through trueSettings and add corresponding rules dynamically
          trueSettings.forEach((setting, index) => {
            if (settingRules[setting]) {
              rules += `\n- ${settingRules[setting]}`;
            }
          });

          console.log(rules);

          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "You are a professional LinkedIn user who provides respectful, thoughtful, and engaging comments on posts.",
              },
              {
                role: "user",
                content: rules,
              },
            ],
            store: true,
          });

          const commentText = completion.choices[0].message.content;
          console.log("response from chatgpt", commentText);

          // const commentText = "Good post!";
          const commentBoxSelector = `div.ql-editor[contenteditable="true"]`;
          // Wait for the comment box to appear
          await page.waitForSelector(commentBoxSelector, {
            visible: true,
            timeout: 10000,
          });
          // Focus on the comment box
          await page.focus(commentBoxSelector);
          // Type the comment
          await page.type(commentBoxSelector, commentText);
          console.log("Comment typed successfully.");
          const commentButtonSelector = `button.comments-comment-box__submit-button--cr`;
          // Ensure the Comment button is enabled and visible
          await page.waitForSelector(commentButtonSelector, { visible: true });
          // Click on the Comment button
          await page.click(commentButtonSelector);
          console.log("Comment posted successfully.");

          await CommentDetail.create({
            userid,
            creatorid: profileId,
            comment: commentText,
            postData,
            postUrl,
          });

          await delay(2000);
        } else {
          console.log("commented found");
        }
      }
    }

    res.json({
      status: "success",
      message: `Cron job is executed`,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/cronjobForTagSearch", async (req, res) => {
  const postData = req.body;
  const creatorid = CleanHTMLData(CleanDBData(postData.creatorId));

  try {
    const users = await User.find({ role: { $ne: 'admin' } })
    console.log("🚀 ~ router.post ~ users:", users);
    for (const user of users) {
      const userid = user._id.toString();
      const Keywords = await Keyword.find({ userid: userid, status: "active" });
      console.log("🚀 ~ router.post ~ Keywords:", Keywords);

      const profileUrl = "https://www.linkedin.com/in/floria-doe-2aab36348/";
      await page.goto(profileUrl, { waitUntil: "load", timeout: 60000 });

      for (const keyword of Keywords) {
        const userid = keyword.userid;
        const userKeyword = keyword.keyword;
        console.log("🚀 ~ router.post ~ userKeyword:", userKeyword);

        const inputSelector = "input.search-global-typeahead__input";
        // Step 1: Click on the search input field
        await page.click(inputSelector);
        // Step 2: Wait for the input field to appear
        await page.waitForSelector(inputSelector, { visible: true });
        // Step 3: Clear the input field
        await page.evaluate((selector) => {
          document.querySelector(selector).value = "";
        }, inputSelector);
        // Define the tag to search (e.g., "react posts")
        const tagToSearch = `${userKeyword} posts`;
        // Step 4: Type the search term into the input field
        await page.type(inputSelector, tagToSearch);
        // Step 4: Press Enter to submit the search
        await page.keyboard.press("Enter");
        // Wait for the search results page to load (optional)
        await page.waitForNavigation({ waitUntil: "load", timeout: 60000 });
        // Optionally, you can do further actions or capture the result here
        console.log("Keyword searched");
        await page.waitForSelector(
          'ul[role="list"] li.search-results__search-feed-update',
          { visible: true }
        );
        // Select all posts
        const recentPostsElement = await page.$$(
          'ul[role="list"] li.search-results__search-feed-update'
        );
        const firstPost = recentPostsElement[0];
        if (firstPost) {
          // Locate the "Comment" button within the first post
          const commentButton = await firstPost.$(
            `button[aria-label="Comment"]`
          );
          if (commentButton) {
            // Click the "Comment" button
            await commentButton.click();

            const commentText = "Good post!";
            const commentBoxSelector = `div.ql-editor[contenteditable="true"]`;
            // Wait for the comment box to appear
            await page.waitForSelector(commentBoxSelector, {
              visible: true,
              timeout: 10000,
            });
            // Focus on the comment box
            await page.focus(commentBoxSelector);
            // Type the comment
            await page.type(commentBoxSelector, commentText);
            console.log("Comment typed successfully.");

            const commentButtonSelector = `button.comments-comment-box__submit-button--cr`;
            // Ensure the Comment button is enabled and visible
            await page.waitForSelector(commentButtonSelector, {
              visible: true,
            });
            await delay(2000);
            // Click on the Comment button
            await page.click(commentButtonSelector);
            await delay(2000);

            console.log("Comment submitted successfully!");
          } else {
            console.error("Comment button not found in the first post.");
          }
        } else {
          console.error("No posts found to comment on.");
        }
      }
    }

    res.json({
      status: "success",
      message: `Cron job is executed`,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.json({
      status: "error",
      message: "Something want wrong",
    });
  }
});

router.post("/cronjobToSinglePostReactAndComment", async (req, res) => {
  const PostUrl = "https://www.linkedin.com/posts/faisal-akhtar-663650296_git-code-devlife-activity-7298535715586347008-pB7-?utm_source=share&utm_medium=member_desktop&rcm=ACoAAEekgKsBrmFcR47JU7h_Z3yCBkb1MWaWAqQ"
  const comment = "Great post!";
  const reactionType = "Support";

  try {
    await page.goto(PostUrl, { waitUntil: "load", timeout: 60000 });

    // Wait for the post container
    await page.waitForSelector("main");
    await page.waitForSelector("div.update-components-text.update-components-update-v2__commentary");

    console.log("Navigated to post successfully.");

    const postData = await page.evaluate(() => {
      // Select the first matching element
      return (document.querySelector("div.update-components-text.update-components-update-v2__commentary").textContent.trim() || "No post found"
      );
    });

    console.log("🚀 ~ PostData:", postData);

    // Commenting on the post (if provided)
    if (comment) {
      const commentBoxSelector = `div.ql-editor[contenteditable="true"]`;
      await page.waitForSelector(commentBoxSelector, { visible: true, timeout: 10000 });
      await page.focus(commentBoxSelector);
      await page.type(commentBoxSelector, comment);
      console.log("Comment typed successfully.");

      const commentButtonSelector = `button.comments-comment-box__submit-button--cr`;
      await page.waitForSelector(commentButtonSelector, { visible: true });
      await page.click(commentButtonSelector);
      console.log("Comment posted successfully.");
    }

    // Reacting to the post (if provided)
    if (reactionType) {
      const reactionButtonSelector = `button.react-button__trigger`;

      // Hover over the reaction button to reveal the options
      await page.waitForSelector(reactionButtonSelector, { visible: true });
      await page.hover(reactionButtonSelector);
      console.log("Hovered over the reaction button.");

      // Define reaction selector based on type
      const reactionSelectors = {
        like: "button[aria-label='React Like']",
        celebrate: "button[aria-label='React Celebrate']",
        support: "button[aria-label='React Support']",
        love: "button[aria-label='React Love']",
        insightful: "button[aria-label='React Insightful']",
        funny: "button[aria-label='React Funny']",
      };

      if (reactionSelectors[reactionType.toLowerCase()]) {
        // Wait for reaction options to appear
        await page.waitForSelector(reactionSelectors[reactionType.toLowerCase()], { visible: true });
        // Click on the desired reaction
        await page.click(reactionSelectors[reactionType.toLowerCase()]);
        console.log(`Reaction '${reactionType}' added successfully.`);
      } else {
        console.log("Invalid reaction type provided.");
      }
    }

    res.json({
      status: "success",
      message: `Cron job executed: ${reactionType ? `Reacted with ${reactionType}.` : ""} ${comment ? "Comment added." : ""}`,
    });
  } catch (error) {
    console.error("Error:", error);
    res.json({
      status: "error",
      message: "Something went wrong",
    });
  }
});

// cronjob to get recent post single tab
router.post('/cronjobtogetrecentpost', async (req, res) => {
  try {

    const users = await User.find({ role: { $ne: 'admin' } })
    for (const user of users) {
      const userid = user._id.toString();
      const linkedAccounts = await LinkedAccount.find({ userid: userid, status: "active" });
      // console.log("🚀 ~ router.post ~ linkedAccounts:", linkedAccounts)
      for (const linkedAccount of linkedAccounts) {
        const linkedAccountId = linkedAccount._id.toString();
        const creators = await Creator.find({ linkedAccountId, status: "active" });
        // console.log("linkedAccountId:", linkedAccountId, "creators:", creators.length)

        for (const creator of creators) {
          const profileUrl = creator.url;
          const creatorid = creator._id;

          await page.goto(profileUrl, { waitUntil: "load", timeout: 60000 });
          // find the recent post and click on the comment button and open new page
          await page.waitForSelector("div.feed-shared-update-list-carousel");
          await page.evaluate(() => {
            document.querySelectorAll("div.feed-shared-update-list-carousel").forEach((feedUpdate) => {
              const ulTag = feedUpdate.querySelector("ul");
              if (!ulTag) return;

              const commentButton = ulTag.querySelector(
                'li button[aria-label="Comment"]'
              );
              if (commentButton) commentButton.click();
            });
          });
          // find the comment input box and type the comment
          await page.waitForSelector("main");
          await page.waitForSelector("div.update-components-text.update-components-update-v2__commentary");

          // const postData = await page.evaluate(() => {
          //   // Select the first matching element
          //   return (
          //     document.querySelector("div.update-components-text.update-components-update-v2__commentary").textContent.trim() || "No post found"
          //   );
          // });
          // console.log("🚀 ~ PostData:", postData);

          const postUrl = page.url(); // Get the current URL
          // console.log("Post URL:", postUrl);

          const checkPostUrl = await CommentDetail.findOne({ userid, linkedAccountId, creatorid, postUrl, });
          // console.log("🚀 ~ router.post ~ checkPostUrl:", checkPostUrl);

          if (checkPostUrl === null) {
            console.log("previous commented not found");

            await CommentDetail.create({ userid, linkedAccountId, creatorid, postUrl, status: 'pending' });

            await delay(2000);
          } else {
            console.log("commented found");
          }

        }
      }
    }
    res.json({ status: "success", message: 'Data saved successfully', });
  } catch (error) {
    console.error(error);
    res.json({ message: 'Error saving data', error });
  }
});

// cronjob to get recent post multi tab
router.post('/cronjobtogetrecentpostmuititab', async (req, res) => {
  try {
    // Dynamic import of p-limit to avoid ESM issue
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(5); // Max 5 concurrent tasks

    const users = await User.find({ role: { $ne: 'admin' } });

    for (const user of users) {
      const userid = user._id.toString();
      const linkedAccounts = await LinkedAccount.find({ userid, status: "active" });

      for (const linkedAccount of linkedAccounts) {
        const linkedAccountId = linkedAccount._id.toString();
        const creators = await Creator.find({ linkedAccountId, status: "active" });

        const tasks = creators.map((creator) =>
          limit(() => scrapeRecentPost({ creator, userid, linkedAccountId }))
        );

        await Promise.all(tasks); // Wait for all creator tasks
      }
    }

    res.json({ status: "success", message: "Data saved successfully" });
  } catch (error) {
    console.error("Error in fetch-latest-posts:", error);
    res.status(500).json({ message: "Error saving data", error });
  }
});

router.post('/cronjobtocommentrecentpostfromdbmultibrowser', async (req, res) => {
  try {
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(3); // Limit to 3 browsers in parallel

    const postsData = await CommentDetail.find({ status: 'pending' });

    const groupedByUser = postsData.reduce((acc, obj) => {
      const { userid, linkedAccountId } = obj;
      acc[userid] = acc[userid] || {};
      acc[userid][linkedAccountId] = acc[userid][linkedAccountId] || [];
      acc[userid][linkedAccountId].push(obj);
      return acc;
    }, {});

    const grouped3DArray = Object.values(groupedByUser).map(userGroup => Object.values(userGroup));

    const jobs = grouped3DArray.map(userGroup =>
      limit(async () => {
        const userid = userGroup[0][0]?.userid;
        const user = await User.findById(userid);
        const login = JSON.parse(user?.cookie);

        const email = login?.email || "";
        const password = login?.password || "";

        const browser = await puppeteer.launch({
          headless: false,
          args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
          defaultViewport: null,
          userDataDir: `./tmp/puppeteer-sessions/profiles/${email.split('@')[0]}`,
          // args: ['--proxy-server=http://your.proxy:port']
        });

        // await page.authenticate({ username: 'username', password: 'password' });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(60000);

        // Go to LinkedIn homepage with existing session
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');

        await page.goto("https://www.linkedin.com/feed", { waitUntil: 'domcontentloaded' });

        let isLoggedIn = false;

        console.log("🚀 isLoggedIn before:", isLoggedIn)
        try {
          const profilePhoto = await page.$('img.global-nav__me-photo')
          console.log("🚀 ~ limit ~ profilePhoto:", profilePhoto)

          if (profilePhoto) {
            isLoggedIn = true;
            console.log(`✅ Already logged in for ${email}`);
          } else {
            console.log(`🔐 Not logged in for ${email}`);
          }
        } catch (e) {
          console.log(`🔐 Not logged in for ${email} — login attempt required.`);
        }

        console.log("🚀 isLoggedIn after:", isLoggedIn)

        if (isLoggedIn === false) {

          const cookies = await page.cookies('https://www.linkedin.com');
          for (const cookie of cookies) {
            await page.deleteCookie({ name: cookie.name, domain: cookie.domain });
          }
          console.log("✅ All LinkedIn cookies deleted.");


          await page.goto("https://www.linkedin.com/login", { waitUntil: 'domcontentloaded' });

          await page.waitForSelector('input[name="session_key"]', { timeout: 10000 });
          await page.waitForSelector('input[name="session_password"]', { timeout: 10000 });

          await page.type('input[name="session_key"]', email, { delay: 100 });
          await page.type('input[name="session_password"]', password, { delay: 100 });

          await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
          ]);


          const currentUrl = page.url();
          const isLoggedIn = currentUrl.includes('/feed');

          console.log(`🔍 Current URL: ${currentUrl}`);
          console.log(`✅ Logged in: ${isLoggedIn}`);


          // Double-check login success
          // const profilePhoto = await page.$('img.global-nav__me-photo');
          // if (profilePhoto) {
          //   console.log(`✅ Login successful for ${email}`);
          // } else {
          //   console.error(`❌ Login failed for ${email}`);
          //   // await browser.close();
          //   return;
          // }
        }




        for (const linkedGroup of userGroup) {
          const linkedAccountId = linkedGroup[0]?.linkedAccountId;
          const linkedAccount = await LinkedAccount.findById(linkedAccountId);
          const nameToClick = linkedAccount?.name;
          console.log("🚀 ~ limit ~ nameToClick:", nameToClick)

          // await delay(10000);

          for (const post of linkedGroup) {
            const { postUrl, userid, linkedAccountId, creatorid } = post;

            console.log("🚀 ~ Navigating to Post:", postUrl);
            await delay(2000);
            await page.goto(postUrl, { waitUntil: "load", timeout: 60000 });
            await delay(2000);

            await page.waitForSelector("main");

            await page.waitForSelector("div.update-components-text.update-components-update-v2__commentary");

            const { postData, postAuthor } = await page.evaluate(() => {
              const postData = document.querySelector("div.update-components-text.update-components-update-v2__commentary")?.textContent.trim() || "No post found";
              const postAuthor = document.querySelector(".update-components-actor__title span[aria-hidden='true']")?.textContent.trim() || "Author not found";
              return { postData, postAuthor };
            });

            console.log("🚀 ~ PostData:", postData);
            console.log("👤 ~ Author:", postAuthor);

            let commentSetting = await CommentSetting.findOne({ creatorid, linkedAccountId })
              ?? await CommentSetting.findOne({ creatorid: "0", linkedAccountId });

            const enabledCommentSettings = ["emoji", "hashtag", "lowercase", "exclamation", "author"]
              .filter(setting => commentSetting?.[setting]);

            const linkedAccountTone = await LinkedAccountTone.findOne({ linkedAccountId });

            const {
              commentsLength,
              formalityLevel,
              personality,
              questionsFrequency,
              tone,
              gender
            } = linkedAccountTone || {};

            const settingRules = {
              emoji: "Turn on emojis and use 1 or 2.",
              hashtag: "Turn on hashtags and use 1 or 2.",
              lowercase: "Write in lowercase letters.",
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

            let rules = "Write a human-like comment and follow the rules below:";
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

            // const completion = await openai.chat.completions.create({ ...})
            const commentText = "Good post!";
            const commentBoxSelector = `div.ql-editor[contenteditable="true"]`;
            // Wait for the comment box to appear
            await page.waitForSelector(commentBoxSelector, {
              visible: true,
              timeout: 10000,
            });
            // Focus on the comment box
            await page.focus(commentBoxSelector);
            // Type the comment
            await page.type(commentBoxSelector, commentText);
            console.log("Comment typed successfully.");

            const commentButtonSelector = `button.comments-comment-box__submit-button--cr`;
            // Ensure the Comment button is enabled and visible
            await page.waitForSelector(commentButtonSelector, { visible: true });
            // Click on the Comment button
            // await page.click(commentButtonSelector);

            console.log("Comment posted successfully.");

            await delay(3000);
          }
        }

        await browser.close();
      })
    );

    await Promise.all(jobs);

    res.json({ status: "success", message: 'All jobs processed with concurrency control' });

  } catch (error) {
    console.error("❌ Error during job:", error);
    res.json({ status: "error", message: 'Error saving data', error });
  }
});
