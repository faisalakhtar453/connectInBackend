// sanitization.js

const sanitizeHtml = require('sanitize-html'); // For better HTML sanitization
const User = require('../models/User');
const jwt = require('jsonwebtoken');
// const backendURL = `http://localhost:8000/`;
const backendURL = `https://b439-103-232-142-183.ngrok-free.app/`;

// Cleans data for database inputs (e.g., for MongoDB)
function CleanDBData(data) {
  const dataType = typeof data;

  if (Array.isArray(data)) {
    return data.map(item => CleanDBData(item));
  } else if (dataType === 'object' && data !== null) {
    const sanitizedObject = {};
    for (let key in data) {
      if (data.hasOwnProperty(key)) {
        sanitizedObject[key] = CleanDBData(data[key]);
      }
    }
    return sanitizedObject;
  } else if (dataType === 'number') {
    return data; // No sanitization needed for numbers
  } else {
    // return sanitizeString(data);
    return data
  }
}


// Cleans data for HTML inputs (use a library for HTML sanitization)
function CleanHTMLData(data) {
  const dataType = typeof data;

  if (dataType === 'number') {
    return data;
  } else {
    return sanitizeHtml(String(data), {
      allowedTags: [],  // Remove all tags, or specify allowed ones
      allowedAttributes: {}
    });
  }
}


const jwtSecretKey = process.env.JWT_SECRET

async function checkAuthorization(req, res) {
  // Check if the authorization header is present
  if (!req.headers.authorization) {
    res.json({ status: 'error', message: 'Authorization header is missing.' });
    return false;
  } else {
    const token = req.headers.authorization.split(' ')[1];
    return new Promise((resolve) => {
      jwt.verify(token, jwtSecretKey, async (err, user) => {
        if (err) {
          res.json({ status: 'error', message: 'token_expired' });
          resolve(false); // Use resolve instead of reject
        } else {
          try {
            // const userData = await User.findOne({ username: user.username });
            const userData = await User.findById(user.id)

            if (userData && userData._id == user.id) {
              resolve(userData.id);
            } else {
              res.json({ status: 'error', message: 'Invalid User.' });
              resolve(false); // Use resolve instead of reject
            }
          } catch (error) {
            console.error('Error fetching user:', error);
            res.json({ status: 'error', message: 'Server error occurred' });
            resolve(false); // Use resolve instead of reject
          }
        }
      });
    });
  }
}

async function adminAuthorization(req, res) {
  if (!req.headers.authorization) {
    res.status(401).json({ status: "error", message: "Authorization header is missing." });
    return false;
  } else {
    const token = req.headers.authorization.split(" ")[1];
    return new Promise((resolve) => {
      jwt.verify(token, jwtSecretKey, async (err, decodedUser) => {
        if (err) {
          res.status(401).json({ status: "error", message: "token_expired" });
          resolve(false);
        } else {
          try {
            const user = await User.findOne({ username: decodedUser.username });
            if (user && user.role === "admin") {
              resolve(user); // Admin verified
            } else {
              res.status(401).json({ status: "error", message: "Invalid admin User." });
              resolve(false);
            }
          } catch (error) {
            res.status(500).json({ status: "error", message: "Server error occurred" });
            resolve(false);
          }
        }
      });
    });
  }
}

function generateRandomCode() {
  const characters = '0123456789abcdefghijklmnopqrstuvwxyz';
  const length = 24; // Default length set to 24
  let randomCode = '';
  
  for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomCode += characters[randomIndex];
  }
  
  return randomCode;
}

module.exports = {
  backendURL,
  CleanDBData,
  CleanHTMLData,
  checkAuthorization,
  adminAuthorization,
  generateRandomCode,
};
