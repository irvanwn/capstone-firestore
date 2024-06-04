const express = require("express");
const app = express();

const admin = require("firebase-admin");
const credentials = require("./key.json");

const dbname = "dbusers"

admin.initializeApp({
  credential: admin.credential.cert(credentials) 
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = admin.firestore();

app.post('/create', async (req, res) => {
  try {
    const { email, firstName, lastName, password, age } = req.body;

    // Validation
    if (!email || !firstName || !lastName || !password || !age) {
      return res.status(400).send({ error: 'All fields are required.' });
    }

    const userJson = {
      email,
      firstName,
      lastName,
      password,
      age,
    };

    const response = await db.collection(dbname).add(userJson); 
      res.send(response);
    } catch(error) {
      res.status(500).send(error);
    }
  });
  
  app.get('/read/all', async (req, res) => {
    try {
      const usersRef = db.collection(dbname);
      const response = await usersRef.get();
      let responseArr = [];
      response.forEach(doc => {
        responseArr.push(doc.data());
      });
      res.send(responseArr);
    } catch (error) {
      res.send(error);
    }
  });

  app.get('/read/:id', async (req, res) => {
  try {
    const userRef = db.collection(dbname).doc(req.params.id);
    const response = await userRef.get();
    res.send(response.data());
  } catch (error) {
    res.send(error);
  }
});

app.post('/update', async(req, res) => {
    try {
        const id=req.body.id;
        const newFirstName = "hello world";
        const userRef = await db.collection(dbname).doc(id).update({
            firstName: newFirstName
        });
        res.send(userRefresponse); 
    } catch (error) {
      res.send(error);
    }
});

app.delete('/delete/:id', async(req, res) => {
    try {
        const response = await db.collection(dbname).doc(req.params.id).delete();
        res.send(response); 
    } catch (error) {
      res.send(error);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
