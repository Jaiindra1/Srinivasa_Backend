const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require('sqlite3')
const cors = require("cors"); // Import CORS package

const axios = require("axios");
const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all requests

// Database connection
const dbPath = path.join(__dirname, "shop_billing.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(5000, () => {
      console.log("Server Running at http://localhost:5000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// ✅ Sample API Route
app.get('/Products', async (req, res) => {
    const query = `SELECT * FROM Products where Company != "sheen Lac";`;
    const result = await db.all(query);
    console.log('Fetching Products.....');
    res.json(result); // Send the actual database data
});

app.get('/SheenLac', async (req, res) => {
  try {
    const query = `SELECT * FROM Products WHERE LOWER(Company) = LOWER(?);`;
    const result = await db.all(query, ['sheen Lac']);
    
    console.log('Fetching Products.....');
    res.json(result);
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get("/SheenLac/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input
    if (!id) return res.status(400).json({ error: 'Product ID is required' });

    const query = `SELECT * FROM Sheenlac WHERE ProductId = ?`;
    const result = await db.all(query, [id]);

    if (result.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Data sent');
    res.json(result);
  } catch (error) {
    console.error('Error fetching product by ID:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get("/BaseOptions/:id", async (req, res) => {
      const { id } = req.params; // Extract Product ID from request params
      const query = `select * from Paints where Productid = ${id} `;  
      const result = await db.all(query);
      res.json(result)
      console.log('data sent')
});

let paymentStatus = { isPaid: false }; // ✅ Store payment status

// ✅ Route to get payment status
app.get("/payment-status", (req, res) => {
  res.json({ isPaid: false }); // Test response
});
// ✅ Route to manually update payment (Simulated Webhook)
app.post("/update-payment", (req, res) => {
    const { isPaid } = req.body;
    if (isPaid) {
        paymentStatus.isPaid = true;
    }
    res.json({ message: "Payment status updated", status: paymentStatus });
});

app.post("/save-bill", async (req, res) => {
  const { todoList, total, date, time, year } = req.body;
  try {
    const query = `INSERT INTO bills (total_amount, date, time, year) VALUES (?, ?, ?, ?)`;
    const result = await db.run(query, [total, date, time, year]);
    const billId = result.lastID;
    try {
      // Prepare the insert query
      const query = `INSERT INTO bill_items (bill_id, product, Base, Liters, quantity, discount, gst, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      // Iterate over each item and insert separately
      for (const item of todoList) {
          await db.run(query, [
              billId,
              item.product,
              item.base,
              item.liters,
              item.quantity,
              item.discount,
              item.gst,
              item.price
          ]);
      }
  } catch (err) {
      console.error("SQL Error:", err);
      res.status(500).json({ error: err.message });
  }
    res.json({ message: "Bill saved successfully", billId: result.lastID });
  } catch (err) {
    console.error("SQL Error:", err);
    res.status(500).json({ error: err.message });
  }

});


app.get("/get-product-report/month", async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
      return res.status(400).json({ error: "Month and Year are required!" });
  }

  try {
      const query = `
          SELECT bi.product, 
                 SUM(bi.quantity) AS quantity, 
                 SUM(bi.price) AS price, 
                 SUM(bi.gst) AS gst, 
                 b.date,
           strftime('%m', b.date) AS month 
          FROM bill_items bi
          JOIN bills b ON bi.bill_id = b.id
          WHERE strftime('%m', b.date) = ? 
          AND strftime('%Y', b.date) = ?
          GROUP BY bi.product, b.date
          ORDER BY b.date DESC
      `;

      const result = await db.all(query, [month, year]); // Pass month and year as parameters
      res.json(result);
  } catch (err) {
      console.error("SQL Error:", err);
      res.status(500).json({ error: err.message });
  }
});

app.get("/get-product-report/day", async (req, res) => {
  const { month, day, year } = req.query;

  if (!day || !year) {
      return res.status(400).json({ error: "Day and Year are required!" });
  }

  try {
    const query = `
    SELECT bi.product, 
           SUM(bi.quantity) AS quantity, 
           SUM(bi.price) AS price, 
           SUM(bi.gst) AS gst, 
           b.date,
           strftime('%m', b.date) AS month
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE strftime('%m', b.date) = ? 
    AND strftime('%d', b.date) = ? 
    AND strftime('%Y', b.date) = ?
    GROUP BY bi.product, b.date
    ORDER BY b.date DESC
`;

const result = await db.all(query, [month.padStart(2, "0"), day.padStart(2, "0"), year]);

      res.json(result);
  } catch (err) {
      console.error("SQL Error:", err);
      res.status(500).json({ error: err.message });
  }
});

// API to Add Loan Details
app.post("/add-loan", async (req, res) => {
  const { candidateName, mobileNumber, loanProduct, address, EmulsionsData, createdAt } = req.body;
  console.log(candidateName, mobileNumber, loanProduct, address, EmulsionsData, createdAt);
  if (!candidateName || !mobileNumber ) {
      return res.status(400).json({ error: "All required fields must be filled." });
  }

  let productDetails = "";
  let price = 0;
  let gst = 0;

  if (Array.isArray(EmulsionsData) && EmulsionsData.length > 0) {
      productDetails = EmulsionsData.map(item => `${item.company} ${item.base} ${item.product} ${item.liters} ${item.quantity}`).join(", ");
      price = EmulsionsData.reduce((total, item) => total + parseFloat(item.price || 0), 0);
      gst = EmulsionsData.reduce((total, item) => total + parseFloat(item.gst || 0), 0);
  }

  const sql = `INSERT INTO loans (candidateName, mobileNumber, loanProduct, address, LoanData, Price, status, GST, createdAt) 
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`;  
  const values = [candidateName, mobileNumber, loanProduct, address, productDetails, price, gst, createdAt];

  try {
      const result = await db.run(sql, values);
      res.status(201).json({ message: "Loan added successfully", loanId: result.lastID });
  } catch (err) {
      console.error("Error inserting loan:", err);
      res.status(500).json({ error: "Database error" });
  }
});

// API to Fetch All Loans
app.get("/loans", async (req, res) => {
  try {
    const query = `SELECT * FROM loans 
where status != 'Closed';`;
    const response = await db.all(query);
 // Debugging

    res.json(response); // ✅ Send response to client
  } catch (error) {
    console.error("Error fetching loans:", error);
    res.status(500).json({ error: "Internal Server Error" }); // ✅ Handle errors properly
  }
});

app.patch("/loans/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
      const result = await db.run("UPDATE loans SET status = ? WHERE id = ?", [status, id]);

      if (result.changes === 0) {
          return res.status(404).json({ error: "Loan not found" });
      }

      res.json({ message: "Loan status updated successfully" });
  } catch (error) {
      console.error("Error updating loan status:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/gloans", async (req, res) => {
  try {
    const query = `SELECT * FROM loans;`;
    const response = await db.all(query);
 // Debugging
    res.json(response); // ✅ Send response to client
  } catch (error) {
    console.error("Error fetching loans:", error);
    res.status(500).json({ error: "Internal Server Error" }); // ✅ Handle errors properly
  }
});

app.get("/ploans", async (req, res) => {
  try {
    const query = `SELECT sum(Price) as Price, count(id) as ID FROM loans 
where status != 'Closed';`;
    const response = await db.all(query);
 // Debugging
    res.json(response); // ✅ Send response to client
  } catch (error) {
    console.error("Error fetching loans:", error);
    res.status(500).json({ error: "Internal Server Error" }); // ✅ Handle errors properly
  }
});

app.get("/ActiveBorrowers", async (req, res) => {
  try {
    const query = `SELECT COUNT(candidateName) as Number FROM loans;`;
    const response = await db.all(query);

    if (response.length > 0) {
      res.json(response[0]); // ✅ Send only the first object
    } else {
      res.json({ Number: 0 }); // ✅ Handle empty response
    }
  } catch (error) {
    console.error("Error fetching loans:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/totalProducts', async (req, res) => {
  try {
    const query = `SELECT COUNT(ProductName) AS total FROM Products;`;
    const result = await db.get(query);
    res.json(result || { total: 0 }); // Ensure response even if no data
  } catch (error) {
    console.error("Database query error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/recent-loans", async (req, res) => {
  try {
    const query = `SELECT candidateName, Price, createdAt as time FROM loans ORDER BY createdAt DESC LIMIT 5;`;
    const response = await db.all(query);
    res.json(response);
  } catch (error) {
    console.error("Error fetching recent loans:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get('/cpvc', async (req, res) => {
  try {
    const query = `SELECT * FROM otherproducts where category = "CPVC";`;
    const response = await db.all(query);
    res.json(response);
  } catch (error) {
    console.error("Error fetching recent loans:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get('/upvc', async (req, res) => {
  try {
    const query = `SELECT * FROM otherproducts where category = "UPVC";`;
    const response = await db.all(query);
    res.json(response);
  } catch (error) {
    console.error("Error fetching recent loans:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get('/Tanks', async (req, res) => {
  try {
    const query = `SELECT * FROM otherproducts where category = "Tanks";`;
    const response = await db.all(query);
    res.json(response);
  } catch (error) {
    console.error("Error fetching recent loans:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/:category/product/:name", async (req, res) => {
  const { category, name } = req.params;

  try {
    const query = `SELECT * FROM cpvcorpvc WHERE product_name = ?;`;
    const response = await db.all(query, [req.params.name]);
    res.json(response);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
  
  });
app.get("/3-layer", async (req, res) => {
  try {
    const query = `SELECT * FROM Tanks WHERE layer = '3 Layer'`;
    const response = await db.all(query);
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching 3 Layer data.");
  }
});

// Route to fetch 4 Layer Tanks
app.get("/4-layer", async (req, res) => {
  try {
    const result =  `SELECT * FROM Tanks WHERE layer = '4 Layer'`;
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching 4 Layer data.");
  }
});


