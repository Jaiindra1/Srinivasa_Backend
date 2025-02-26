const express = require("express");
const path = require("path");
const cors = require("cors"); // Import CORS package

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all requests



    app.listen(5000, () => {
      console.log("Server Running at http://localhost:5000/");
    });
 

initializeDBAndServer();

// ✅ Sample API Route
app.get('/Products', async (req, res) => {
    const query = `SELECT * FROM Products;`;
    const result = await db.all(query);
    console.log('Fetching Products.....');
    res.json(result); // Send the actual database data
});

app.get("/BaseOptions/:id", async (req, res) => {
      const { id } = req.params; // Extract Product ID from request params
      const query = `select * from Paints where Productid = ${id} `;  
      const result = await db.all(query);
      res.json(result)
      console.log('data sent succesfully')
});

