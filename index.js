const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
app.use(cors());
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

const run = async () => {
  try {
    await client.connect(); // comment for production

    const db = client.db("Nestrix");
    const properties = db.collection("properties");
    const users = db.collection("user");

    app.get("/api/feature-properties", async (req, res) => {
      const query = {
        featured: true,
      };
      const result = await properties.find(query).limit(6).toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 }); // comment for production
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    //   await client.close();
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Nestrix-server!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
