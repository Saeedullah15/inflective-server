const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://inflective-61d79.web.app",
        "https://inflective-61d79.firebaseapp.com"
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// custom middlewares
const logger = (req, res, next) => {
    console.log("inside logger: ", req.method, req.url);
    next();
}

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    console.log("token inside verifyToken: ", token);

    if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized access" });
        }
        req.user = decoded;
        next();
    })
}

// cookie configuration
//localhost:5000 and localhost:5173 are treated as same site. so sameSite value must be strict in development server.  in production sameSite will be none
// in development server secure will false. in production secure will be true
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

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
        // auth related api
        app.post("/jwt", async (req, res) => {
            const userEmail = req.body;

            const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
            res.cookie("token", token, cookieOptions).send({ success: true });
        })

        app.post("/logout", async (req, res) => {
            res.clearCookie("token", { ...cookieOptions, maxAge: 0 }).send("cookie cleared");
        })

        // queries api
        app.post("/addQuery", verifyToken, async (req, res) => {
            const newQueryInfo = req.body;
            const result = await myQueryCollection.insertOne(newQueryInfo);
            res.send(result);
        })

        app.get("/allQueries", async (req, res) => {
            const searchText = req.query.searchText || "";
            const query = {
                ProductName: { $regex: searchText, $options: 'i' } // case insensitive search
            };
            const options = {
                // Sort returned documents in ascending/descending order. "1" for ascending and "-1" for descending
                sort: { currentDate: -1 }
            };
            const cursor = await myQueryCollection.find(query, options).toArray();
            res.send(cursor);
        })

        app.get("/myQueries", verifyToken, async (req, res) => {
            const userEmail = req.query.email;
            // console.log(userEmail);
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: "forbidden access" });
            }

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

        app.get("/queryDetails/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await myQueryCollection.findOne(query);
            res.send(result);
        })

        app.put("/updateQuery/:id", verifyToken, async (req, res) => {
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

        app.delete("/deleteQuery/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await myQueryCollection.deleteOne(query);
            res.send(result);
        })

        // recommendation api
        app.post("/addRecommendation", verifyToken, async (req, res) => {
            const newRecommendation = req.body;
            const result = await recommendationCollection.insertOne(newRecommendation);
            res.send(result);
        })

        app.get("/allRecommendations", async (req, res) => {
            const queryId = req.query.queryId;
            // console.log(queryId);
            const query = { QueryId: queryId };
            const cursor = await recommendationCollection.find(query).toArray();
            res.send(cursor);
        })

        app.get("/myRecommendations", verifyToken, async (req, res) => {
            const email = req.query.email;
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: "forbidden access" });
            }

            const query = { RecommenderEmail: email };
            const cursor = await recommendationCollection.find(query).toArray();
            res.send(cursor);
        })

        app.get("/recommendations", verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { UserEmail: email };
            const cursor = await recommendationCollection.find(query).toArray();
            res.send(cursor);
        })

        app.put("/updateRecommendationCount/:id", async (req, res) => {
            const id = req.params.id;
            const recommendationCount = req.body;
            // console.log(recommendationCount);

            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $inc: {
                    recommendationCount: 1
                }
            }
            // { $inc: { recommendationCount: 1 } }

            const result = await myQueryCollection.updateOne(filter, updatedDoc);
            // console.log(result);
            res.send(result);
        })

        app.delete("/deleteRecommendations/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await recommendationCollection.deleteOne(query);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
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