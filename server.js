// last ver fix with (default) database on firestore
const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require('uuid')
require('dotenv').config();
const credentials = require(process.env.FIREBASE_CREDENTIALS_PATH);

const dbname = "dbusers";

admin.initializeApp({
  credential: admin.credential.cert(credentials)
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = admin.firestore();


function validateToken(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    return res.status(401).send("Access denied. Bearer token is required.");
  }

  let token;
  if (authorizationHeader.startsWith('Bearer ')) {
    token = authorizationHeader.split(' ')[1]; // Extract the token after "Bearer "
  } else {
    token = authorizationHeader; // This assumes the token is directly provided without "Bearer "
  }
  // Check if token exists and is valid
  // Here, we assume Token is stored in Firestore
  db.collection(dbname)
    .where("Token", "==", token)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        return res.status(401).send("Invalid token.");
      }
      // Token is valid, proceed to next middleware or route handler
      next();
    })
    .catch((err) => {
      console.error("Error validating token:", err);
      res.status(500).send("Internal server error");
    });
}


app.get('/users', async (req, res) => {
  try {
    const usersRef = db.collection(dbname);
    const snapshot = await usersRef.get();
    const users = [];

    snapshot.forEach(doc => {
      users.push({ email: doc.id, ...doc.data() });
    });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/user/:email', async (req, res) => {
  try {
    const userEmail = req.params.email;
    const userRef = db.collection(dbname).doc(userEmail);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send("User not found");
    }

    res.status(200).json({ email: userDoc.id, ...userDoc.data() });
  } catch (error) {
    res.status(500).send(error.message);
  }
});


app.post('/user/signup', async (req, res) => {
  try {
    const { email, firstName, lastName, password, age } = req.body;

    // Hash the password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    // Validate required fields
    if (!email || !firstName || !lastName || !password || !age) {
      return res.status(400).send({ error: 'All fields are required' });
    }

    // Check if email already exists
    const userRef = db.collection(dbname).doc(email);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      return res.status(400).send({ error: 'Email already exists' });
    }

    // Generate a unique token (example using UUID)
    const uniqueToken = uuidv4(); // Generate UUID

    // Store user data including the hashed password and token
    const userJson = {
      Token: uniqueToken,
      email,
      firstName,
      lastName,
      salt,
      password: hashedPassword,
      age: parseInt(age),
      loginAttempt: 0
    };

    await userRef.set(userJson);
    res.status(201).send({ error: false, message: 'User created' });
  } catch (error) {
    res.status(500).send(error.message);
  }
});


app.post("/user/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send("Email and password are required");
    }

    const userRef = db.collection(dbname).doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(400).send("Email doesn't exist");
    }

    const user = userDoc.data();

    if (user.loginAttempt >= 50) {
      return res.status(429).send("Too many login attempts. Please try again later.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await userRef.update({ loginAttempt: (user.loginAttempt || 0) + 1 });
      return res.status(400).send("Invalid password");
    }

    await userRef.update({ loginAttempt: 0 });

    res.status(200).send({
      error: false,
      message: 'Login successful',
      loginResult: {
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        age: user.age,
        Token: user.Token
      }
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.put('/user/update/:email', validateToken ,async (req, res) => {
  try {
    const userEmail = req.params.email;
    const { firstName, lastName, password, age } = req.body;

    const userRef = db.collection(dbname).doc(userEmail);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send("User not found");
    }

    const user = userDoc.data();

    const updatedUser = {
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      age: age || user.age,
    };

    if (password) {
      const salt = await bcrypt.genSalt();
      const hashedPassword = await bcrypt.hash(password, salt);
      updatedUser.password = hashedPassword;
      updatedUser.salt = salt;
    }

    await userRef.update(updatedUser);

    res.status(200).send("User updated successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete('/user/delete/:email', validateToken , async (req, res) => {
  try {
    const userEmail = req.params.email;
    const userRef = db.collection(dbname).doc(userEmail);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send("User not found");
    }

    await userRef.delete();

    res.status(200).send("User "+ userEmail +" deleted successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
