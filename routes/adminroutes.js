const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require('multer');
const path = require('path');
const cron = require('node-cron');
require("dotenv").config();
// const url = "https://backendapp.threearrowstech.com"

const { adminAuthorization, CleanHTMLData, CleanDBData } = require("../config/sanitization");
const User = require("../models/User");
const Package = require("../models/Package");

router.post("/getUsersDetail", async (req, res) => {
  const postData = req.body;
  // const hear = CleanHTMLData(CleanDBData(postData.hear));

  try {
    const authUser = await adminAuthorization(req, res);
    if (authUser) {
      const users = await User.find({ role: { $ne: 'admin' } }).sort({ createdAt: -1 });
      // const users = await User.find().sort({ createdAt: -1 });

      // Populate packages for each user based on packageid
      const usersWithPackages = await Promise.all(
        users.map(async (user) => {
          const packageDoc = await Package.findById(user.packageid);
          return {
            ...user.toObject(),
            package: packageDoc || null
          };
        })
      );

      return res.json({
        status: "success",
        data: usersWithPackages
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});

router.post("/getDefaultPackage", async (req, res) => {
  const postData = req.body;
  const userId = CleanHTMLData(CleanDBData(postData.userId));

  try {
    const authUser = await adminAuthorization(req, res);
    if (authUser) {
      // const data = await Package.find({ type: "default" })

      // Step 1: Get all default packages
      const defaultPackages = await Package.find({ type: "default" });

      // Step 2: Get the user and their package manually
      const user = await User.findById(userId);
      let userPackage = null;

      if (user?.packageid) {
        userPackage = await Package.findById(user.packageid);
      }

      // Step 3: If user has a custom package and it's not already in the list
      let allPackages = [...defaultPackages];

      if (userPackage && userPackage.type === "custom") {
        const exists = defaultPackages.some(pkg => pkg._id.equals(userPackage._id));
        if (!exists) {
          allPackages.push(userPackage);
        }
      }

      return res.json({
        status: "success",
        data: allPackages,
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});

router.post("/updateUserPackage", async (req, res) => {
  const postData = req.body;
  const PkgId = CleanHTMLData(CleanDBData(postData.PkgId));
  const userId = CleanHTMLData(CleanDBData(postData.userId));

  try {
    const authUser = await adminAuthorization(req, res);
    if (authUser) {
      await User.findByIdAndUpdate(userId, { packageid: PkgId }, { new: true });

      return res.json({
        status: "success",
        message: "User package updated successfully",
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});

router.post("/addUserCustomPackage", async (req, res) => {
  const postData = req.body;
  const name = CleanHTMLData(CleanDBData(postData.customValues.name));
  const accountLimit = CleanHTMLData(CleanDBData(postData.customValues.accountLimit));
  const commentLimit = CleanHTMLData(CleanDBData(postData.customValues.commentLimit));
  const creatorLimit = CleanHTMLData(CleanDBData(postData.customValues.creatorLimit));
  const pageLimit = CleanHTMLData(CleanDBData(postData.customValues.pageLimit));
  const profileLimit = CleanHTMLData(CleanDBData(postData.customValues.profileLimit));
  const userId = CleanHTMLData(CleanDBData(postData.userId));
  const pkgId = CleanHTMLData(CleanDBData(postData.pkgId));

  try {
    const authUser = await adminAuthorization(req, res);
    if (authUser) {
      // Check if package type is custom
      const package = await Package.findById(pkgId);
      let newPackage

      if (package && package.type === 'custom') {
        // Perform actions for custom package type
        newPackage = await Package.findByIdAndUpdate({ _id: pkgId }, {
          name,
          commentLimit,
          accountLimit,
          profileLimit,
          pageLimit,
          creatorLimit,
        }, { new: true, upsert: true });
      } else {
        newPackage = await Package.create({
          name,
          commentLimit,
          accountLimit,
          profileLimit,
          pageLimit,
          creatorLimit,
          type: "custom",
        });
      }
      await User.findByIdAndUpdate(userId, { packageid: newPackage._id }, { new: true });

      return res.json({
        status: "success",
        message: "User package updated successfully",
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});


router.post("/getPackageForUpdate", async (req, res) => {
  const postData = req.body;
  const userId = CleanHTMLData(CleanDBData(postData.userId));

  try {
    const authUser = await adminAuthorization(req, res);
    if (authUser) {
      const data = await Package.find({ type: "default" })

      return res.json({
        status: "success",
        data,
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});

router.post("/editUserCustomPackage", async (req, res) => {
  const postData = req.body;
  const id = CleanHTMLData(CleanDBData(postData.customValues._id));
  const name = CleanHTMLData(CleanDBData(postData.customValues.name));
  const accountLimit = CleanHTMLData(CleanDBData(postData.customValues.accountLimit));
  const commentLimit = CleanHTMLData(CleanDBData(postData.customValues.commentLimit));
  const creatorLimit = CleanHTMLData(CleanDBData(postData.customValues.creatorLimit));
  const monthlyPrice = CleanHTMLData(CleanDBData(postData.customValues.monthlyPrice));
  const yearlyPrice = CleanHTMLData(CleanDBData(postData.customValues.yearlyPrice));
  const pageLimit = CleanHTMLData(CleanDBData(postData.customValues.pageLimit));
  const profileLimit = CleanHTMLData(CleanDBData(postData.customValues.profileLimit));
  const bothActive = postData.customValues.bothActive;

  try {
    const authUser = await adminAuthorization(req, res);
    if (authUser) {

      await Package.findByIdAndUpdate({ _id: id }, {
        name,
        commentLimit,
        accountLimit,
        profileLimit,
        pageLimit,
        creatorLimit,
        monthlyPrice,
        yearlyPrice,
        bothActive,
      }, { new: true, upsert: true });

      return res.json({
        status: "success",
        message: "User package updated successfully",
      });
    }
  } catch (error) {
    console.error("error", error.message);
    res.json({ message: "error", error });
  }
});


module.exports = router;
