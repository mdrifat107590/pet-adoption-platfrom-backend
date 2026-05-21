const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();

app.use(express.json());
const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  }),
);
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).send({
        message: "Unauthorized Access",
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
      if (error) {
        return res.status(401).send({
          message: "Invalid Token",
        });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    res.status(500).send({
      message: "Authorization Failed",
    });
  }
};

async function run() {
  try {
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
    app.get("/requests", verifyToken, async (req, res) => {
      try {
        const result = await requestsCollection
          .find({ userEmail: req.user.email })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch requests",
        });
      }
    });

    app.get("/owner-requests", verifyToken, async (req, res) => {
      try {
        const result = await requestsCollection
          .find({ ownerEmail: req.user.email })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch owner requests",
        });
      }
    });
    app.patch("/requests/accept/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const request = await requestsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!request) {
          return res.status(404).send({
            message: "Request not found",
          });
        }

        await requestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "accepted" } },
        );

        await petsCollection.updateOne(
          { _id: new ObjectId(request.petId) },
          { $set: { adoptionStatus: "adopted" } },
        );

        await requestsCollection.updateMany(
          {
            petId: request.petId,
            _id: { $ne: new ObjectId(id) },
          },
          { $set: { status: "rejected" } },
        );

        res.send({ success: true });
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: "Failed to accept request",
        });
      }
    });

    app.patch("/requests/reject/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        await requestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "rejected" } },
        );
        res.send({ success: true });
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: "Failed to reject request",
        });
      }
    });
    app.delete("/requests/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await requestsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to delete request",
        });
      }
    });

    // authentication routes
    app.post("/api/auth/register", async (req, res) => {
      try {
        const { name, email, password } = req.body;
        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          return res.status(400).send({
            message: "User already exists",
          });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userData = {
          name,
          email,
          password: hashedPassword,
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(userData);
        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: "Registration Failed",
        });
      }
    });

    app.post("/api/auth/login", async (req, res) => {
      try {
        const { email, password } = req.body;
        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(400).send({
            message: "Invalid Credentials",
          });
        }

        const isMatched = await bcrypt.compare(password, user.password);
        if (!isMatched) {
          return res.status(400).send({
            message: "Invalid Credentials",
          });
        }

        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
          expiresIn: "7d",
        });

        res.cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
        });

        res.send({
          success: true,
          user: {
            name: user.name,
            email: user.email,
          },
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: "Login Failed",
        });
      }
    });

    app.post("/api/auth/logout", (req, res) => {
      res.clearCookie("token");
      res.send({
        success: true,
      });
    });

    app.post("/api/auth/google-login", async (req, res) => {
      try {
        const { name, email } = req.body;
        let user = await usersCollection.findOne({ email });

        if (!user) {
          const userData = {
            name,
            email,
            provider: "google",
            createdAt: new Date(),
          };

          const result = await usersCollection.insertOne(userData);
          user = {
            _id: result.insertedId,
            ...userData,
          };
        }

        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
          expiresIn: "7d",
        });

        res.cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
        });

        res.send({
          success: true,
          user: {
            name: user.name,
            email: user.email,
          },
        });
      } catch (error) {
        console.log(error);
        res.status(500).send({
          message: "Google Login Failed",
        });
      }
    });

    await client.connect();
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.log(error);
  }
}
run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
