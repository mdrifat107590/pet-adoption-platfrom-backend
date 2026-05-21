const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
console.log("server is running on port", port);