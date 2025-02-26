const express = require("express");
const path = require("path");
const cors = require("cors"); // Import CORS package

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all requests



    app.listen(5000, () => {
      console.log("Server Running at http://localhost:5000/");
    });
 


