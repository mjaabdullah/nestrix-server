const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.Frontend_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const header = req?.headers.authorization;

  if (!header) {
    return res.status(401).send({
      success: false,
      message: "Unauthorized",
    });
  }
  const token = header.split(" ")[1];

  if (!token) {
    return res.status(401).send({
      success: false,
      message: "Unauthorized",
    });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    next();
  } catch (error) {
    return res.status(401).send({
      message: "Forbidden",
    });
  }
};

const run = async () => {
  try {
    // await client.connect(); // comment for production

    const db = client.db("Nestrix");
    const properties = db.collection("properties");
    const users = db.collection("user");
    const reviews = db.collection("reviews");
    const favorites = db.collection("favorites");

    app.get("/api/feature-properties", async (req, res) => {
      const query = {
        featured: true,
      };
      const result = await properties.find(query).limit(6).toArray();
      res.send(result);
    });

    app.get("/api/persons", verifyToken, async (req, res) => {
      try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(
          50,
          Math.max(1, Number(req.query.limit) || 1000),
        );
        const skip = (page - 1) * limit;

        const total = await users.countDocuments();

        const result = await users
          .find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        res.status(200).send({
          success: true,
          data: result,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.patch("/api/person/update", verifyToken, async (req, res) => {
      const { userId, newRole } = req.body;

      if (newRole === "admin")
        return res
          .status(400)
          .send({ message: "Admin role cannot be changed." });

      const allowedRoles = ["tenant", "owner"];

      if (!allowedRoles.includes(newRole)) {
        return res.status(400).send({
          success: false,
          message: "Invalid role.",
        });
      }

      const result = await users.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { role: newRole } },
      );
      res.send({
        success: true,
        message: "User role updated successfully.",
      });
    });

    app.get("/api/properties", async (req, res) => {
      try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 6;

        const skip = (page - 1) * limit;

        // Query Params
        const location = req.query.location;
        const propertyType = req.query.propertyType;
        const minPrice = Number(req.query.minPrice);
        const maxPrice = Number(req.query.maxPrice);

        // Base Query
        const query = {
          status: "Approved",
        };

        // Location Filter
        if (location) {
          query.location = {
            $regex: location,
            $options: "i",
          };
        }

        // Property Type Filter
        if (propertyType) {
          query.propertyType = propertyType;
        }

        // Price Filter
        if (minPrice || maxPrice) {
          query.rent = {};

          if (minPrice) {
            query.rent.$gte = minPrice;
          }

          if (maxPrice) {
            query.rent.$lte = maxPrice;
          }
        }

        // Total Count
        const total = await properties.countDocuments(query);

        // Data Fetch
        const result = await properties
          .find(query)
          .skip(skip)
          .limit(limit)
          .toArray();

        res.send({
          success: true,
          data: result,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            limit,
          },
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/api/properties/:id", verifyToken, async (req, res) => {
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

    app.post("/api/add-to-favorite", verifyToken, async (req, res) => {
      const newFavorite = req.body;

      const isFavorite = await favorites.findOne({
        userId: newFavorite.userId,
        propertyId: newFavorite.propertyId,
      });

      if (isFavorite) {
        return res.status(400).send({
          message: "Property already favorited",
        });
      }
      const result = await favorites.insertOne({
        ...newFavorite,
        addedAt: new Date(),
      });
      res.send(result);
    });

    app.delete("/api/remove-from-favorite", verifyToken, async (req, res) => {
      try {
        const { userId, propertyId } = req.body;

        const result = await favorites.deleteOne({
          userId,
          propertyId,
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Favorite not found",
          });
        }

        res.send({
          success: true,
          message: "Favorite removed successfully",
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    app.get("/api/favorites", verifyToken, async (req, res) => {
      try {
        const { userId, propertyId } = req.query;

        if (propertyId) {
          const favorite = await favorites.findOne({
            userId,
            propertyId,
          });

          return res.send({
            success: true,
            isFavorite: !!favorite,
            data: favorite,
          });
        }
        const result = await favorites
          .find({ userId })
          .sort({ createdAt: -1 })
          .toArray();

        if (!result) {
          return res.status(404).send({
            success: false,
            message: "Favorite not found",
          });
        }

        res.send({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/api/favorites-by-user", verifyToken, async (req, res) => {
      const { userId } = req.query;

      const favoriteList = await favorites.find({ userId }).toArray();
      const allProperties = await properties.find({}).toArray();

      const result = favoriteList.map((favorite) => {
        const property = allProperties.find(
          (item) => item._id.toString() === favorite.propertyId,
        );

        return {
          _id: favorite._id,
          propertyId: favorite.propertyId,
          propertyTitle: property?.title || "",
          location: property?.location || "",
          price: property?.rent || 0,
          priceType: property?.rentType || "Hourly",
          image: property?.images?.[0] || "",
          addedAt: favorite.addedAt,
        };
      });

      res.send(result);
    });
    app.post("/api/new/review", verifyToken, async (req, res) => {
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
          totalReviews > 0
            ? Number((totalRating / totalReviews).toFixed(1))
            : 0;

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

    app.get("/api/reviews/:propertyId", verifyToken, async (req, res) => {
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
