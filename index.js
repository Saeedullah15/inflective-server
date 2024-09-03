const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());

// connection string
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yyrxfdz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // collections
        const myQueryCollection = client.db("InflectiveDB").collection("myQueryCollection");
        const recommendationCollection = client.db("InflectiveDB").collection("recommendationCollection");

        // api's here
        // queries api
        app.post("/addQuery", async (req, res) => {
            const newQueryInfo = req.body;
            const result = await myQueryCollection.insertOne(newQueryInfo);
            res.send(result);
        })

        app.get("/allQueries", async (req, res) => {
            const query = {};
            const options = {
                // Sort returned documents in ascending/descending order. "1" for ascending and "-1" for descending
                sort: { currentDate: -1 }
            };
            const cursor = await myQueryCollection.find(query, options).toArray();
            res.send(cursor);
        })

        app.get("/myQueries", async (req, res) => {
            const userEmail = req.query.email;
            // console.log(userEmail);
            const query = { UserEmail: userEmail };
            const options = {
                // Sort returned documents in ascending/descending order. "1" for ascending and "-1" for descending
                sort: { currentDate: -1 },
                // Include only the `title` and `imdb` fields in each returned document
                projection: { _id: 1, QueryTitle: 1, UserName: 1, currentDate: 1 },
            };
            const cursor = await myQueryCollection.find(query, options).toArray();
            res.send(cursor);
        })

        app.get("/queryDetails/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await myQueryCollection.findOne(query);
            res.send(result);
        })

        app.put("/updateQuery/:id", async (req, res) => {
            const id = req.params.id;
            const updatedInfo = req.body;
            const filter = { _id: new ObjectId(id) };
            // const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    ProductName: updatedInfo.ProductName,
                    ProductBrand: updatedInfo.ProductBrand,
                    ProductImage: updatedInfo.ProductImage,
                    QueryTitle: updatedInfo.QueryTitle,
                    Reason: updatedInfo.Reason,
                    currentDate: updatedInfo.currentDate
                }
            }
            const result = await myQueryCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete("/deleteQuery/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await myQueryCollection.deleteOne(query);
            res.send(result);
        })

        // recommendation api
        app.post("/addRecommendation", async (req, res) => {
            const newRecommendation = req.body;
            const result = await recommendationCollection.insertOne(newRecommendation);
            res.send(result);
        })

        app.put("/updateRecommendationCount/:id", async (req, res) => {
            const id = req.params.id;
            const recommendationCount = req.body;
            console.log(recommendationCount);

            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $inc: {
                    recommendationCount: 1
                }
            }
            // { $inc: { recommendationCount: 1 } }

            const result = await myQueryCollection.updateOne(filter, updatedDoc);
            console.log(result);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("inflective server is running......");
})

app.listen(port, () => {
    console.log(`server is running on port ${port}`);
})