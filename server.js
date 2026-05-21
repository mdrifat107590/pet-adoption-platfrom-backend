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
    app.get("/pets/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await petsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch pet",
        });
      }
    });
    app.post("/pets", verifyToken, async (req, res) => {
      try {
        const petData = req.body;
        petData.createdAt = new Date();
        petData.userEmail = req.user.email;
        petData.adoptionStatus = "available";

        const result = await petsCollection.insertOne(petData);
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to add pet",
        });
      }
    });
    app.put("/pets/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedPet = req.body;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = { $set: updatedPet };

        const result = await petsCollection.updateOne(query, updatedDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to update pet",
        });
      }
    });
    app.delete("/pets/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await petsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to delete pet",
        });
      }
    });

    // requets routes
    app.post("/requests", verifyToken, async (req, res) => {
      try {
        const requestData = req.body;
        const pet = await petsCollection.findOne({
          _id: new ObjectId(requestData.petId),
        });

        if (!pet) {
          return res.status(404).send({
            message: "Pet not found",
          });
        }

        if (pet.adoptionStatus === "adopted") {
          return res.status(400).send({
            message: "Pet already adopted",
          });
        }

        if (pet.userEmail === req.user.email) {
          return res.status(400).send({
            message: "You cannot adopt your own pet",
          });
        }

        const existingRequest = await requestsCollection.findOne({
          petId: requestData.petId,
          userEmail: req.user.email,
        });

        if (existingRequest) {
          return res.status(400).send({
            message: "You already requested this pet",
          });
        }

        requestData.status = "pending";
        requestData.createdAt = new Date();
        requestData.userEmail = req.user.email;
        requestData.ownerEmail = pet.userEmail;

        const result = await requestsCollection.insertOne(requestData);
        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: "Failed to submit request",
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
