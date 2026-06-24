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
    // await client.connect(); // comment for production

    const db = client.db("Nestrix");
    const properties = db.collection("properties");
    const users = db.collection("user");
    const reviews = db.collection("reviews");

    app.get("/api/feature-properties", async (req, res) => {
      const query = {
        featured: true,
      };
      const result = await properties.find(query).limit(6).toArray();
      res.send(result);
    });

    app.get("/api/properties/:id", async (req, res) => {
      console.log("working");
      try {
        const id = req.params.id;

        const result = await properties.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({
            message: "Property not found",
          });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Invalid Property id",
        });
      }
    });
   app.post("/api/new/review", async (req, res) => {
     try {
       const newReview = req.body;

       // Save Review
       const result = await reviews.insertOne(newReview);

       // Get All Reviews For This Property
       const propertyReviews = await reviews
         .find({
           propertyId: newReview.propertyId,
         })
         .toArray();

       const totalReviews = propertyReviews.length;

       const totalRating = propertyReviews.reduce(
         (acc, review) => acc + review.rating,
         0,
       );

       const averageRating =
         totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(1)) : 0;

       // Update Property
       await properties.updateOne(
         {
           _id: new ObjectId(newReview.propertyId),
         },
         {
           $set: {
             averageRating,
             totalReviews,
           },
         },
       );

       res.send(result);
     } catch (error) {
       console.error(error);

       res.status(500).send({
         success: false,
         message: "Internal Server Error",
       });
     }
   });

   app.get("/api/reviews/:propertyId", async (req, res) => {
     const id = req.params.propertyId;

     const result = await reviews
       .find({
         propertyId: id,
       })
       .toArray();
     if (!result) {
       return res.status(404).send({
         message: "Review not found",
       });
     }
     res.send(result);
   });

    // await client.db("admin").command({ ping: 1 }); // comment for production
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
