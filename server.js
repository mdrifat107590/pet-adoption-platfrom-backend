const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();

app.use(express.json());
const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully");

    const database = client.db("pawHavenDB");
    const petsCollection = database.collection("pets");
    const requestsCollection = database.collection("requests");
    const usersCollection = database.collection("users");

    app.get("/", (req, res) => {
      res.send("PawHaven Server Running...");
    });

    app.get("/pets/featured", async (req, res) => {
      try {
        const result = await petsCollection.find({}).limit(6).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch featured pets",
        });
      }
    });
    app.get("/pets", async (req, res) => {
      try {
        const search = req.query.search || "";
        const species = req.query.species || "";
        const email = req.query.email || "";
        let query = {};

        if (search) {
          query.petName = {
            $regex: search,
            $options: "i",
          };
        }

        if (species) {
          query.species = species;
        }

        if (email) {
          query.userEmail = email;
        }

        const result = await petsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: "Failed to fetch pets",
        });
      }
    });

    
  } catch (error) {
    console.log(error);
  }
}
run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
