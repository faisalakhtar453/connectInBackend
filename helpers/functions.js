const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const secretKey = process.env.jwtSecretKey;

async function checkAuthorization(req, res) {
  // Check if the authorization header is present
  if (!req.headers.authorization) {
    res.status(401).json({ status: 'error', message: 'Authorization header is missing.' });
    return false;
  } else {
    const token = req.headers.authorization.split(' ')[1];
    return new Promise((resolve) => {
      jwt.verify(token, secretKey, async (err, user) => {
        if (err) {
          res.status(401).json({ status: 'error', message: 'token_expired' });
          resolve(false); // Use resolve instead of reject
        } else {
          try {
            const selectUser = await Qry(`SELECT * FROM usersdata WHERE username = '${user.username}'`);
            const userData = selectUser[0];

            if (userData && userData.username === user.username) {
              resolve(userData.id);
            } else {
              res.status(401).json({ status: 'error', message: 'Invalid User.' });
              resolve(false); // Use resolve instead of reject
            }
          } catch (error) {
            console.error('Error executing query:', error);
            res.status(500).json({ status: 'error', message: 'Server error occurred' });
            resolve(false); // Use resolve instead of reject
          }
        }
      });
    });
  }
}

function randomToken(length = 100) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ12345689';
  let myString = '';
  for (let i = 0; i < length; i++) {
    const pos = crypto.randomInt(0, chars.length - 1);
    myString += chars[pos];
  }
  return myString;
}
const capitalizeName = (name) => {
	if (!name) return null;
	const nameParts = name?.split(' ');
	const capitalizedParts = nameParts?.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
	return capitalizedParts?.join(' ');
};

module.exports = { checkAuthorization, randomToken, capitalizeName };