const express = require("express");
const app = express();
const bcrypt = require("bcrypt")
const admin = require("firebase-admin");
require('dotenv').config();
const credentials = require(process.env.FIREBASE_CREDENTIALS_PATH);

const dbname = "dbusers"
const loginAttempt = 0;

admin.initializeApp({
  credential: admin.credential.cert(credentials) 
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = admin.firestore();

const userJson = {}

app.get('/users', async (req, res) => {
  try {
    const usersRef = db.collection(dbname);
    const snapshot = await usersRef.get();
    const users = [];

    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).send(error.message);
  }
}); 

app.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const userRef = db.collection(dbname).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send("User not found");
    }

    res.status(200).json({ id: userDoc.id, ...userDoc.data() });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/users/signup', async (req, res) => {
  try {

    const { email, firstName, lastName, password, age } = req.body;

    const salt = await bcrypt.genSalt()
    const hasedPassword = await bcrypt.hash(password,salt)
    // console.log("Request Body:", req.body);
    // console.log(salt +"|||"+ hasedPassword);


    if (!email) {
      return res.status(400).send({ error: 'email Kosong' });
    } else if(!firstName){
      return res.status(400).send({ error: 'firstname Kosong' });
    } else if(!lastName){
      return res.status(400).send({ error: 'lastname Kosong' });
    } else if(!password){
      return res.status(400).send({ error: 'password kosong' });
    } else if(!age) {
      return res.status(400).send({ error: 'age kosong' });
    }

    const userJson = {
      email,
      firstName,
      lastName,
      salt : salt,
      password : hasedPassword,
      age: parseInt(age),
      loginAttempt : 0
    };

    const response = await db.collection(dbname).add(userJson); 
      res.send(response);
    } catch(error) {
      res.status(500).send(error);
    }
  });
  
  app.post("/users/login", async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return res.status(400).send("Email and password are required");
      }
  
      const usersRef = db.collection(dbname);
      const snapshot = await usersRef.where("email", "==", email).get();
  
      if (snapshot.empty) {
        return res.status(400).send("Invalid email or password");
      }
  
      const userDoc = snapshot.docs[0];
      const user = userDoc.data();
      const userRef = userDoc.ref;
  

      if (user.loginAttempt >= 50) {
        return res.status(429).send("Too many login attempts. Please try again later.");
      }
  
      const isPasswordValid = await bcrypt.compare(password, user.password);
  
      if (!isPasswordValid) {
        await userRef.update({ loginAttempt: (user.loginAttempt || 0) + 1 });
        return res.status(400).send("Invalid email or password");
      }
  
      await userRef.update({ loginAttempt: 0 });
  
      res.status(200).send("Login successful, welcome " + user.firstName);
    } catch (error) {
      res.status(500).send(error.message);
    }
  });
  
  app.put('/users/update/:id', async (req, res) => {
    try {
      const userId = req.params.id;
      const { email, firstName, lastName, password, age } = req.body;
  
      const userRef = db.collection(dbname).doc(userId);
      const userDoc = await userRef.get();
  
      if (!userDoc.exists) {
        return res.status(404).send("User not found");
      }
  
      const user = userDoc.data();
  
      const updatedUser = {
        email: email || user.email,
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


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
