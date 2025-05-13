const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const cors = require('cors');






const app = express();
const API_URL = process.env.REACT_APP_API_URL; // Read from .env
// Ensure PORT is defined
const PORT = process.env.PORT || 4000;
// Load allowed origins from .env safely
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));


// Middleware Setup
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Allow preflight requests for all routes
app.options("*", (_req, res) => {
  res.sendStatus(200);
});

// ✅ Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "public/uploads"));
  },
  filename: (_req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname); // example: 1712345678901.pdf
    cb(null, uniqueName);
  },
});
const upload = multer({ storage: storage });
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  res.json({ filePath: `/uploads/${req.file.filename}` });
});


// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect()
  .then(() => console.log("Connected to database successfully"))
  .catch((err) => console.error("Database connection error:", err));


  
// JWT Secret Key
const secretKey = process.env.JWT_SECRET_KEY || "your_jwt_secret_key";

// Function to Insert Log Entry
const logEvent = async (event, description) => {
  try {
    await pool.query("INSERT INTO logs (event, description) VALUES ($1, $2)", [
      event,
      description,
    ]);
  } catch (error) {
    console.error("Error inserting log:", error);
  }
};

// Middleware to check permissions
const checkPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      const token = req.headers["authorization"]?.split(" ")[1];
      if (!token) return res.status(403).json({ success: false, message: "No token provided" });

      jwt.verify(token, secretKey, async (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: "Invalid or expired token" });

        req.user = decoded;
        const { permissions } = decoded;
        const hasPermission = requiredPermissions.every((permission) => permissions.includes(permission));

        if (!hasPermission) {
          return res.status(403).json({ success: false, message: "Permission denied" });
        }

        next();
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
};

app.post("/api/login", async (req, res) => {
  const { employeeId, password } = req.body;

  try {
    // Step 1: Fetch user by employee_id
    const userQuery = `
      SELECT em.employee_id, em.employee_name, em.role_id, rm.role_name, em.password
      FROM employee_master em
      JOIN role_master rm ON em.role_id = rm.role_id
      WHERE em.employee_id = $1
    `;
    const userResult = await pool.query(userQuery, [employeeId]);

    if (userResult.rows.length === 0) {
      await logEvent("Login Failed", `Invalid login attempt: Employee ID ${employeeId} not found.`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    // Step 2: Compare the provided password with the hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await logEvent("Login Failed", `Invalid login attempt for Employee ID: ${employeeId}`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Step 3: Fetch permissions for the role
    const permissionQuery = `
      SELECT p.permission_id, p.permission_name 
      FROM permissions p
      JOIN role_permissions rp ON p.permission_id = rp.permission_id
      WHERE rp.role_id = $1
    `;
    const permissionResult = await pool.query(permissionQuery, [user.role_id]);
    const permissions = permissionResult.rows.map(row => row.permission_id);

    // Step 4: Fetch menus for the role
    const menuQuery = `
      SELECT m.menu_id, m.menu_name 
      FROM role_menu rm 
      JOIN menu_master m ON rm.menu_id = m.menu_id
      WHERE rm.role_id = $1
    `;
    const menuResult = await pool.query(menuQuery, [user.role_id]);
    const menus = menuResult.rows;

    if (menus.length === 0) {
      await logEvent("Login Failed", `User ${employeeId} has no menu access.`);
      return res.status(403).json({ success: false, message: "No menus assigned for this role" });
    }

    // Step 5: Create JWT token
    const payload = {
      employeeId: user.employee_id,
      employeeName: user.employee_name,
      role: user.role_name,
      permissions,
      menus
    };
    const token = jwt.sign(payload, secretKey, { expiresIn: "10m" });

    // Step 6: Log and respond
    await logEvent("User Login", `User ${employeeId} (${user.employee_name}) logged in successfully.`);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      employeeName: user.employee_name,
      employeeId: user.employee_id,
      role: user.role_name,
      permissions,
      menus
    });
  } catch (error) {
    console.error("Login Error:", error);
    await logEvent("Server Error", `Error during login for Employee ID: ${employeeId}`);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all employees
app.get("/api/employees", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM employee_master");
     // Log successful retrieval of employees
     await logEvent("Fetch Employees", "User retrieved employee list.");

    res.status(200).json(result.rows);
  } catch (err) {
     // Log error if the query fails
     await logEvent("Server Error", "Error retrieving employee list.");
    res.status(500).json({ success: false, message: "Server error" });
  }
});

//  trade_master
app.get("/api/trades", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM trade_master");
 // Log successful retrieval of trades
 await logEvent("Fetch Trades", "User retrieved trade list.");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching trades:", error);
    // Log error if query fails
    await logEvent("Server Error", "Error retrieving trade list.");
    res.status(500).json({ error: "Server error fetching trades" });
  }
});


//  trade_master
app.get("/api/trades", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM trade_master");
 // Log successful retrieval of trades
 await logEvent("Fetch Trades", "User retrieved trade list.");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching trades:", error);
    // Log error if query fails
    await logEvent("Server Error", "Error retrieving trade list.");
    res.status(500).json({ error: "Server error fetching trades" });
  }
});

// Add a new employee (requires 'create' permission, ID: 2)
app.post('/api/employees', checkPermission([2]), async (req, res) => {
  const { employee_id, employee_name, designation, email_id, phone_number } = req.body;
  if (!employee_id || !employee_name || !designation || !email_id || !phone_number) {
    await logEvent("Employee Add Failed", "Missing required fields.")
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO employee_master (employee_id, employee_name, designation, email_id, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [employee_id, employee_name, designation, email_id, phone_number]
    );
     // Log successful employee addition
     await logEvent("Employee Added", `Employee ${employee_id} (${employee_name}) added successfully.`);
    res.status(200).json({ success: true, message: 'Employee added successfully', data: result.rows[0] });
  } catch (error) {
    // Log error if insertion fails
    await logEvent("Server Error", `Error adding employee ${employee_id}.`);
    res.status(500).json({ success: false, message: 'Error adding employee' });
  }
});

//trade_employee
app.post("/api/trade_employee", async (req, res) => {
  await logEvent("Trade Assignment Failed", "Missing employee_id or trade_id.");
  const { employee_id, trade_id } = req.body;

  try {
    await pool.query(
      "INSERT INTO trade_employee (employee_id, trade_id) VALUES ($1, $2)",
      [employee_id, trade_id]
    );
    // Log successful trade assignment
    await logEvent("Trade Assigned", `Employee ${employee_id} assigned to trade ${trade_id} successfully.`);

    res.json({ success: true, message: "Employee assigned to trade successfully" });
  } catch (error) {
    console.error("Error associating employee with trade:", error);
    // Log error if insertion fails
    await logEvent("Server Error", `Error assigning employee ${employee_id} to trade ${trade_id}.`);
    res.status(500).json({ error: "Server error linking employee to trade" });
  }
});


// Update employee (requires 'update' permission, ID: 3)
app.put('/api/employees/:employee_id', checkPermission([3]), async (req, res) => {
  const { employee_id } = req.params;
  const { employee_name, designation, email_id, phone_number } = req.body;
  if (!employee_name || !designation || !email_id || !phone_number) {
    await logEvent("Employee Update Failed", `Missing fields for Employee ID: ${employee_id}`);
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  try {
    const result = await pool.query(
      `UPDATE employee_master 
       SET employee_name = $1, designation = $2, email_id = $3, phone_number = $4 
       WHERE employee_id = $5 
       RETURNING *;`, 
      [employee_name, designation, email_id, phone_number, employee_id]
    );
    if (result.rowCount > 0) {
      // Log successful employee update
      await logEvent("Employee Updated", `Employee ${employee_id} updated successfully.`);
      res.json({ success: true, message: 'Employee updated successfully', employee: result.rows[0] });
    } else {
      // Log update attempt where no changes were made
      await logEvent("Employee Update Failed", `No changes made for Employee ID: ${employee_id}`);
      res.json({ success: false, message: 'Employee not found or no changes made' });
    }
  } catch (error) {
     // Log error if update fails
     await logEvent("Server Error", `Error updating Employee ID: ${employee_id}`);
    res.status(500).json({ success: false, message: 'Error updating employee' });
  }
});


//update trade
app.put("/api/trade_employee", async (req, res) => {
  const { employee_id, trade_id } = req.body;

  try {
    await logEvent("Trade Update Failed", "Missing employee_id or trade_id.");
    // Check if employee already has a trade
    const existingTrade = await pool.query("SELECT * FROM trade_employee WHERE employee_id = $1", [employee_id]);

    if (existingTrade.rows.length > 0) {
      // Log successful trade update
      await logEvent("Trade Updated", `Employee ${employee_id} reassigned to trade ${trade_id}.`);
      // Update existing trade
      await pool.query("UPDATE trade_employee SET trade_id = $1 WHERE employee_id = $2", [trade_id, employee_id]);
    } else {
      // Log new trade assignment
      await logEvent("Trade Assigned", `Employee ${employee_id} assigned to trade ${trade_id}.`);
      // Insert new trade association
      await pool.query("INSERT INTO trade_employee (employee_id, trade_id) VALUES ($1, $2)", [employee_id, trade_id]);
    }

    res.json({ success: true, message: "Employee trade updated successfully" });
  } catch (error) {
    console.error("Error updating employee trade:", error);
     // Log error if update fails
     await logEvent("Server Error", `Error updating trade for Employee ID: ${employee_id}.`);
    res.status(500).json({ error: "Server error updating employee trade" });
  }
});


//DELETE
app.delete("/api/employees/:employee_id", checkPermission([4]), async (req, res) => {
  const { employee_id } = req.params;

  try {
    console.log(`Deleting related records for employee ID: ${employee_id}`);
    
    // First, delete dependent records from trade_employee
    await pool.query(
      "DELETE FROM trade_employee WHERE employee_id = $1",
      [employee_id]
    );

    console.log(`Deleting employee with ID: ${employee_id}`);
    
    // Now, delete employee from employee_master
    const result = await pool.query(
      "DELETE FROM employee_master WHERE employee_id = $1 RETURNING *",
      [employee_id]
    );

    if (result.rows.length > 0) {
      console.log(`Employee ID ${employee_id} deleted successfully`);
      res.status(200).json({ success: true, message: "Employee deleted" });
    } else {
      console.log(`Employee ID ${employee_id} not found`);
      res.status(404).json({ success: false, message: "Employee not found" });
    }
  } catch (err) {
    console.error("Error deleting employee:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});


// Fetch current user's permissions
app.get("/api/permissions/current_user", checkPermission([]), async (req, res) => {
  try {
    const { employeeId } = req.user;

    if (!employeeId) 
      {
        await logEvent("Permission Fetch Failed", "Employee ID missing in request.");
        return res.status(400).json({ success: false, message: "Employee ID is required" });
        
      }
    const roleQuery = `SELECT role_id FROM employee_master WHERE employee_id = $1`;
    const roleResult = await pool.query(roleQuery, [employeeId]);

    if (roleResult.rows.length === 0) {
      await logEvent("Permission Fetch Failed", `Invalid Employee ID: ${employeeId}`);
      return res.status(403).json({ success: false, message: "Access denied: Invalid employee ID" });
    }

    const roleId = roleResult.rows[0].role_id;
    const permissionQuery = `SELECT permission_name 
                             FROM permissions p
                             JOIN role_permissions rp ON p.permission_id = rp.permission_id
                             WHERE rp.role_id = $1`;
    const permissionResult = await pool.query(permissionQuery, [roleId]);

    const permissions = permissionResult.rows.map(row => row.permission_name);
    if (permissions.length === 0) {
      await logEvent("Permission Fetch Warning", `No permissions assigned to Employee ID: ${employeeId}`);
      return res.status(403).json({ success: false, message: "No permissions assigned to this role" });
    }
    await logEvent("Permissions Retrieved", `Permissions fetched for Employee ID: ${employeeId}`);
    res.status(200).json({ success: true, permissions });
  } catch (error) {
    await logEvent("Server Error", `Error fetching permissions for Employee ID: ${employeeId}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Fetch roles
app.get("/api/roles", async (_req, res) => {
  try {
    const result = await pool.query("SELECT role_id, role_name FROM role_master");

    await logEvent("Roles Retrieved", `Fetched ${result.rows.length} roles from role_master.`);
    res.status(200).json({
      success: true,
      roles: result.rows, // Sending all roles with role_id and role_name
    });
  } catch (error) {
    console.error("Error fetching roles:", error.message);
    await logEvent("Server Error", "Error fetching roles from role_master.");
    res.status(500).json({ success: false, message: "Error fetching roles" });
  }
});


// Fetch all menus
app.get("/api/menus", async (_req, res) => {
  try {
    const query = `
      SELECT menu_id, menu_name
      FROM menu_master
    `;
    const result = await pool.query(query);
    await logEvent("Menus Retrieved", `Fetched ${result.rows.length} menus from menu_master.`);
    res.status(200).json({
      success: true,
      menus: result.rows, // Send all menus from the menu_master table
    });
  } catch (error) {
    console.error("Error fetching menus:", error.message);
    await logEvent("Server Error", "Error fetching menus from menu_master.");
    res.status(500).json({ success: false, message: "Error fetching menus" });
  }
});

// Assign menus to a role
app.post("/api/assign-menus", async (req, res) => {
  const { role_id, menu_ids } = req.body;

  try {
    // Input validation
    if (!role_id || !menu_ids || !Array.isArray(menu_ids) || menu_ids.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid data: role_id or menu_ids missing/invalid" });
    }

    // Start a transaction
    await pool.query("BEGIN");

    // Delete existing role-menu assignments for the role
    const deleteQuery = "DELETE FROM role_menu WHERE role_id = $1";
    await pool.query(deleteQuery, [role_id]);

    // Prepare query for inserting new role-menu assignments
    const insertQuery = `
      INSERT INTO role_menu (role_id, menu_id)
      VALUES ${menu_ids.map((_, index) => `($1, $${index + 2})`).join(", ")}
    `;

    // Execute the insertion
    await pool.query(insertQuery, [role_id, ...menu_ids]);

    // Commit the transaction
    await pool.query("COMMIT");

    // Log successful assignment
    await logEvent("Role Menu Assignment", `Assigned ${menu_ids.length} menus to role ID ${role_id}`);

    res.status(200).json({ success: true, message: "Menus assigned successfully" });
  } catch (error) {
    // Rollback the transaction on any error
    await pool.query("ROLLBACK");

    console.error("Error in /api/assign-menus:", error.message);

    await logEvent("Role Menu Assignment Failed", `Error assigning menus to role ID ${role_id}: ${error.message}`);
    // Respond with a generic error message
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
app.post("/api/work-order", upload.single("document"), async (req, res) => {
  try {
    const {
      controlNumber,
      workOrderNumber,
      projectCode,
      priority,
      groupWorkOrder,
      workOrderDate,
      receivedDate,
      desiredCompletionDate,
      productDescription,
    } = req.body;

    // Validate required fields
    if (
      !controlNumber ||
      !workOrderNumber ||
      !projectCode ||
      !priority ||
      !groupWorkOrder ||
      !workOrderDate ||
      !receivedDate ||
      !desiredCompletionDate ||
      !productDescription
    ) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Validate controlNumber is numeric
    if (!/^\d+$/.test(controlNumber)) {
      return res.status(400).json({ success: false, message: "Control Number must be numeric" });
    }

    // Handle file upload
    const documentPath = req.file ? `uploads/${req.file.filename}` : null;

    // Insert into DB
    const result = await pool.query(
      `INSERT INTO work_order_master (
        control_number, work_order_number, project_code, priority, 
        group_section, work_order_date, received_date, desired_completion_date, 
        product_description, doc_upload_path, created_date, created_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, 1)
      RETURNING control_number`,
      [
        controlNumber,
        workOrderNumber,
        projectCode,
        priority,
        groupWorkOrder,
        workOrderDate,
        receivedDate,
        desiredCompletionDate,
        productDescription,
        documentPath,
      ]
    );

    const insertedControlNumber = result.rows[0].control_number;

    // Log creation
    await logEvent(
      "Work Order Created",
      `Work order ${workOrderNumber} (Control #${insertedControlNumber}) created successfully.`
    );

    res.json({ success: true, controlNumber: insertedControlNumber, documentPath });
  } catch (err) {
    console.error("Error saving work order:", err);
    await logEvent("Work Order Creation Failed", `Error saving work order: ${err.message}`);
    res.status(500).json({ success: false, message: "Error saving work order" });
  }
});

app.post("/api/part", async (req, res) => {
  const client = await pool.connect();
  try {
    const { controlNumber, parts } = req.body;

    // Validate request
    if (!controlNumber || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid part data" });
    }

    // Validate controlNumber is numeric
    if (!/^\d+$/.test(controlNumber)) {
      return res.status(400).json({ success: false, message: "Control Number must be numeric" });
    }

    // Validate controlNumber exists in work_order_master
    const controlNumberCheck = await client.query(
      "SELECT 1 FROM work_order_master WHERE control_number = $1",
      [controlNumber]
    );
    if (controlNumberCheck.rowCount === 0) {
      return res.status(400).json({ success: false, message: "Invalid Control Number" });
    }

    // Begin transaction
    await client.query("BEGIN");

    for (const part of parts) {
      if (!part.partNumber || !part.description || !part.quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Missing part fields" });
      }
      await client.query(
        `INSERT INTO part_master (control_number, part_number, description, quantity, created_date, created_id) 
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 1)`,
        [controlNumber, part.partNumber, part.description, part.quantity]
      );
    }

    // Commit transaction
    await client.query("COMMIT");

    // Log successful part addition
    await logEvent("Parts Added", `Parts added for Control #${controlNumber}`);
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    await logEvent("Part Addition Failed", `Error adding parts for Control #${controlNumber}: ${err.message}`);
    res.status(500).json({ success: false, message: "Error saving parts" });
  } finally {
    client.release();
  }
});
app.get("/api/control-numberss", async (_req, res) => {
  try {
     const result = await pool.query("SELECT control_number FROM work_order_master");
    await logEvent("Control Numbers Fetched", "No control numbers found.");
    res.json(result.rows.map(row => row.control_number));
   } catch (error) {
     await logEvent("Control Number Fetch Failed", error.message);
    console.error("Error fetching control numbers:", error);
    res.status(500).json({ error: "Internal Server Error" });
 }
 });



//assign task
app.get("/parts/:controlNumber", async (req, res) => {
  try {
    const { controlNumber } = req.params;
    const query = `
      SELECT part_number FROM part_master WHERE control_number = $1
    `;
    const result = await pool.query(query, [controlNumber]);

    if (result.rows.length > 0) {

       // Log success event
    await logEvent("Parts Fetch", `Fetched ${result.rows.length} parts for control number: ${controlNumber}`);

      res.json(result.rows.map(row => row.part_number));
    } else {
      await logEvent("Parts Fetch", `No parts found for control number: ${controlNumber}`);
      res.status(404).json({ message: "No parts found" });
    }
  } catch (error) {
    console.error("Database error:", error);
    await logEvent("Parts Fetch Failed", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


// Fetch trade names
app.get("/api/trades", async (_req, res) => {
  try {
    const result = await pool.query("SELECT trade_id, trade_name FROM trade_master");
  // Log success event
  await logEvent("Trade Fetch", `Fetched ${result.rows.length} trades`);
    res.json(result.rows);
  } catch (err) {
    await logEvent("Trade Fetch", "No trades found in trade_master table");
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

app.get("/api/employees/:trade_id", async (req, res) => {
  try {
    const { trade_id } = req.params;
// Log the request event
await logEvent("FETCH_EMPLOYEES", `Fetching employees for trade ID: ${trade_id}`);
    const result = await pool.query(
      `SELECT e.employee_id, e.employee_name 
       FROM trade_employee te 
       JOIN employee_master e ON te.employee_id = e.employee_id 
       WHERE te.trade_id = $1`, 
      [trade_id]
    );

    if (result.rows.length === 0) {
      await logEvent("FETCH_EMPLOYEES", `No employees found for trade ID: ${trade_id}`);
      return res.status(404).json({ message: "No employees found for this trade." });
    }
 // Log success event
 await logEvent("FETCH_EMPLOYEES", `Successfully fetched ${result.rows.length} employees for trade ID: ${trade_id}`);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching employees:", err.message);
      // Log error event
      await logEvent("ERROR", `Error fetching employees for trade ID: ${trade_id} - ${err.message}`);
    res.status(500).send("Server Error");
  }
});

app.post("/api/assign_tasks", upload.single("document"), async (req, res) => {
  try {
    console.log("✅ Received request to assign tasks");

    if (!req.file) {
      console.warn("⚠ No file uploaded!");
      await logEvent("ASSIGN_TASK_ERROR", "No file uploaded");
      return res.status(400).json({ message: "No file uploaded" });
    }

    let tasks;
    try {
      tasks = JSON.parse(req.body.tasks || "[]");
    } catch (jsonError) {
      console.error("⚠ JSON Parse Error:", jsonError);
      return res.status(400).json({ message: "Invalid tasks format" });
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      console.warn("⚠ No tasks provided!");
      await logEvent("ASSIGN_TASK_ERROR", "No tasks provided");
      return res.status(400).json({ message: "No tasks provided" });
    }

    const docUploadPath = `/uploads/${req.file.filename}`;
    console.log("📂 Document path to be saved:", docUploadPath);
    await logEvent("ASSIGN_TASK", `File uploaded: ${docUploadPath}`);

    const assignedBy = req.body.assigned_by; // Get assigned_by from request
    if (!assignedBy) {
      console.warn("⚠ No assigned_by provided!");
      return res.status(400).json({ message: "Assigned by (logged-in employee) is required" });
    }

    for (let task of tasks) {
      const { controlNumber, parts, employees, startDate, endDate } = task;

      console.log("📌 Processing Task:", controlNumber);

      // ✅ Trim employee names to avoid whitespace issues
      const employeeNames = employees.map((e) => e.employee_name.trim());
      console.log("🔍 Fetching Employee IDs for:", employeeNames);

      // ✅ Fetch employee_id from employee_master using employee_name
      const employeeResult = await pool.query(
        `SELECT employee_id, TRIM(employee_name) AS employee_name 
         FROM employee_master 
         WHERE TRIM(employee_name) = ANY($1)`,
        [employeeNames]
      );

      if (employeeResult.rows.length === 0) {
        console.warn(`⚠ No employee IDs found for employees: ${employeeNames.join(", ")}`);
        await logEvent("ASSIGN_TASK_ERROR", `No valid employees found for control number ${controlNumber}`);
        return res.status(400).json({ message: `No valid employees found for control number ${controlNumber}` });
      }

      const employeeIds = employeeResult.rows.map((row) => row.employee_id);
      console.log("✅ Employee IDs:", employeeIds);

      // ✅ Insert into assign_task with assigned_by for each employee separately
      for (let empId of employeeIds) {
        await pool.query(
          `INSERT INTO assign_task (control_number, part_number, employee_id, start_date, end_date, doc_upload_path, assigned_by) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [controlNumber, parts, empId, startDate, endDate, docUploadPath, assignedBy] // Insert each employee separately
        );

        console.log(`✅ Task assigned: ${controlNumber} to Employee ID: ${empId}`);

        // ✅ Insert notification for each employee
        await pool.query(
          `INSERT INTO notifications (employee_id, message, is_read) VALUES ($1, $2, FALSE)`,
          [empId, `You have been assigned a new task: ${controlNumber}`]
        );
      }
    }

    console.log("🎉 All tasks assigned successfully!");
    res.status(201).json({ message: "Tasks assigned successfully!" });

  } catch (error) {
    console.error("❌ Error assigning tasks:", error);
    await logEvent("ASSIGN_TASK_ERROR", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/assigned-menus/:roleId", async (req, res) => {
  const { roleId } = req.params;
  try {
      const assignedMenus = await db.query(
          "SELECT menu_id FROM role_menu WHERE role_id = $1",
          [roleId]
      );

      console.log("Fetched Menus:", assignedMenus.rows);

      res.json({
          success: true,
          menu_ids: assignedMenus.rows.map((row) => row.menu_id),
      });
  } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ success: false, message: "Error fetching menus" });
  }
});
//futter apis
// Get employee details by ID
app.get("/api/employee/details/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT employee_name, employee_id, email_id, designation FROM employee_master WHERE employee_id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Log successful employee retrieval
    await logEvent("Fetch Employee", `User retrieved details for employee ID: ${id}`);

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching employee details:", err);
    await logEvent("Server Error", `Error retrieving employee ID: ${id}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/assigned-jobs/:empId", async (req, res) => {
  try {
    const empId = req.params.empId;
    const query = `
      SELECT * FROM assign_task
      WHERE employee_id = $1;  
    `;

    const { rows } = await pool.query(query, [empId]);

    if (rows.length > 0) {
      res.json({ success: true, job: rows });
    } else {
      res.json({ success: false, job: [] });
    }
  } catch (error) {
    console.error("❌ Database error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/job-details/:controlNumber/:id", async (req, res) => {
  const controlNumber = parseInt(req.params.controlNumber, 10);
  const id = parseInt(req.params.id, 10); // Get job ID

  console.log("📌 Received Control Number:", controlNumber);
  console.log("📌 Received Job ID:", id);

  if (isNaN(controlNumber) || isNaN(id)) {
    console.log("❌ Invalid parameters received!");
    return res.status(400).json({ success: false, message: "Invalid parameters" });
  }

  try {
    const jobQuery = `
    SELECT 
      a.id, 
      a.control_number, 
      a.status,  -- ✅ Include the status field
      a.part_number,  
      a.start_date, 
      a.end_date, 
      COALESCE(STRING_AGG(DISTINCT e.employee_name, ', '), 'Unknown') AS employee_names,  
      JSON_AGG(
        DISTINCT JSONB_BUILD_OBJECT(
          'part_number', pm.part_number,
          'quantity', pm.quantity,
          'description', pm.description
        )
      ) AS part_details,  
      w.group_section, 
      w.priority
    FROM assign_task a
    JOIN work_order_master w 
      ON a.control_number = w.control_number
    LEFT JOIN part_master pm 
      ON pm.part_number = ANY(a.part_number) 
    LEFT JOIN employee_master e 
      ON e.employee_id = a.employee_id 
    WHERE a.control_number = $1 
    AND a.id = $2  
    GROUP BY a.id, a.control_number, a.status, a.part_number, a.start_date, a.end_date, w.group_section, w.priority;
  `;
  

    console.log("📡 Executing Query for:", controlNumber, "Job ID:", id);
    const { rows } = await pool.query(jobQuery, [controlNumber, id]);

    if (rows.length > 0) {
      console.log("✅ Job details found!");
      return res.json({ success: true, job_details: rows[0] });
    } else {
      console.log("❌ No job details found for:", controlNumber, "Job ID:", id);
      return res.status(404).json({ success: false, message: "No job details found" });
    }
  } catch (error) {
    console.error("❌ Error fetching job details:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

//both flutter and web 
app.get("/api/notifications/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    console.log("🟢 API Received Employee ID:", employeeId);

    const query = `SELECT id, message, is_read, created_at FROM notifications 
                   WHERE employee_id = $1 ORDER BY created_at DESC`;
    console.log("🟡 Executing Query:", query, "With Parameter:", employeeId);

    const result = await pool.query(query, [employeeId]);

    console.log("📋 Query Result:", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//flutter
app.post("/api/notifications/read/:empId", async (req, res) => {
  const { empId } = req.params;
  try {
      await pool.query("UPDATE notifications SET is_read = TRUE WHERE employee_id = $1", [empId]);
      res.json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
      console.error("❌ Error updating notifications:", error);
      res.status(500).json({ success: false, message: "Server error" });
  }
});


// Leave Requests API
app.get("/api/leaverequests", async (_req, res) => {
  try {
    const leaveRequests = await pool.query("SELECT * FROM leave_request");
    res.json(leaveRequests.rows);
  } catch (error) {
    console.error("❌ Error fetching leave requests:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/api/leaverequests", async (req, res) => {
  const { emp_id, emp_name, leave_type, start_date, end_date, reason } = req.body;

  try {
    await pool.query(
      "INSERT INTO leave_request (emp_id, emp_name, leave_type, start_date, end_date, reason, status) VALUES ($1, $2, $3, $4, $5, $6, 'Pending')",
      [emp_id, emp_name, leave_type, start_date, end_date, reason]
    );
    res.status(201).json({ message: "Leave request added" });
  } catch (error) {
    console.error("❌ Error adding leave request:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

//web
app.put("/api/leaverequests/:id", async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  try {
    await pool.query("UPDATE leave_request SET status = $1 WHERE id = $2", [status, id]);
    res.json({ message: "Leave request updated" });
  } catch (error) {
    console.error("❌ Error updating leave request:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/api/leave_master", async (_req, res) => {
  try {
    const result = await pool.query("SELECT id, leave_type FROM leave_master");
    res.json(result.rows); // ✅ Returns an array of leave types
  } catch (error) {
    console.error("❌ Error fetching leave types:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

//web
app.post("/api/leaverequests", async (req, res) => {
  const { emp_id, leave_type, half_day, start_date, end_date, reason } = req.body;

  try {
    await pool.query(
      "INSERT INTO leave_requests (emp_id, leave_type, half_day, start_date, end_date, reason) VALUES ($1, $2, $3, $4, $5, $6)",
      [emp_id, leave_type, leave_type === "Casual Leave" ? half_day : null, start_date, end_date, reason]
    );

    res.status(201).json({ success: true, message: "Leave request submitted successfully" });
  } catch (error) {
    console.error("❌ Error inserting leave request:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

//web
app.get("/api/employee_master/:employee_id", async (req, res) => {
  const { employee_id } = req.params; // ✅ Use employee_id
  try {
    const result = await pool.query(
      "SELECT employee_name FROM employee_master WHERE employee_id = $1",
      [employee_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    res.json({ employee_name: result.rows[0].employee_name }); // ✅ Ensure correct field name
  } catch (error) {
    console.error("❌ Error fetching employee:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});


// DELETE Leave Request API
app.delete("/api/leaverequests/:id", async (req, res) => {
  const { id } = req.params;

  try {
      // Check if the leave request exists
      const leaveRequest = await pool.query("SELECT * FROM leave_request WHERE id = $1", [id]);
      
      if (leaveRequest.rows.length === 0) {
          return res.status(404).json({ message: "Leave request not found" });
      }

      // Delete the leave request
      await pool.query("DELETE FROM leave_request WHERE id = $1", [id]);

      res.status(200).json({ message: "Leave request deleted successfully" });
  } catch (error) {
      console.error("Error deleting leave request:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/update-task-status", async (req, res) => {
  console.log("📥 Incoming Request:", req.body);

  const { id, status, employee_id, assigned_by } = req.body;

  if (!id || !status) {
    return res.status(400).json({ success: false, message: "⚠️ Missing id or status" });
  }

  try {
    const checkQuery = `
      SELECT status, actual_start_date 
      FROM assign_task 
      WHERE id = $1 
      ${employee_id ? 'AND employee_id = $2' : ''}
      ${assigned_by ? 'AND assigned_by = $3' : ''}
    `;
    
    const queryParams = [id];
    if (employee_id) queryParams.push(employee_id);
    if (assigned_by) queryParams.push(assigned_by);

    const checkResult = await pool.query(checkQuery, queryParams);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "❌ Job not found" });
    }

    const currentStatus = checkResult.rows[0].status ? checkResult.rows[0].status.toLowerCase() : null;
    const newStatus = status.toLowerCase();

    console.log(`🔍 Current Status in DB: ${currentStatus || "NULL"}`);

    if (newStatus === "ongoing") {
      if (currentStatus === "ongoing") {
        return res.status(400).json({ success: false, message: "⚠️ Task is already ongoing!" });
      }

      const shouldUpdateStartDate = !checkResult.rows[0].actual_start_date;
      
      // REMOVED updated_at FROM THIS QUERY
      const updateQuery = `
        UPDATE assign_task 
        SET 
          status = 'ongoing'
          ${shouldUpdateStartDate ? ', actual_start_date = NOW()' : ''}
        WHERE id = $1
        RETURNING status, actual_start_date
      `;
      
      const updateResult = await pool.query(updateQuery, [id]);
      const updatedStatus = updateResult.rows[0].status;
      const updatedStartDate = updateResult.rows[0].actual_start_date;

      console.log("✅ Task Accepted & Status Changed to ONGOING");
      return res.json({ 
        success: true, 
        message: "✅ Task Accepted & Status Changed to ONGOING!", 
        status: updatedStatus,
        actual_start_date: updatedStartDate
      });
    }

    return res.status(400).json({ success: false, message: "⚠️ Invalid status update request" });

  } catch (error) {
    console.error("❌ Error updating job status:", error);
    res.status(500).json({ 
      success: false, 
      message: "🚨 Internal Server Error", 
      error: error.message 
    });
  }
});
app.post("/update-job-status", async (req, res) => {
  console.log("📥 Incoming Request:", req.body);

  const { id, status, reason, update_hold_date } = req.body;

  // Validate required fields
  if (!id || !status) {
    return res.status(400).json({ 
      success: false, 
      message: "⚠️ Missing id or status" 
    });
  }

  try {
    // Check current status
    const checkQuery = `
      SELECT status, actual_end_date, on_hold_date 
      FROM assign_task 
      WHERE id = $1
    `;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "❌ Job not found" 
      });
    }

    const currentStatus = checkResult.rows[0].status?.toLowerCase();
    const newStatus = status.toLowerCase();

    // Handle status transitions
    switch (newStatus) {
      case "on hold":
        if (currentStatus !== "ongoing" && currentStatus !== "pending") {
          return res.status(400).json({
            success: false,
            message: `⛔ Only ONGOING or PENDING tasks can be put on hold. Current status: ${currentStatus?.toUpperCase() || "NULL"}`,
          });
        }

        if (!reason) {
          return res.status(400).json({ 
            success: false, 
            message: "⚠️ Hold reason is required" 
          });
        }

        const updateQuery = `
          UPDATE assign_task 
          SET 
            status = 'on hold',
            hold_reason = $1,
            on_hold_date = CURRENT_TIMESTAMP,
            actual_end_date = NULL
          WHERE id = $2
          RETURNING status, on_hold_date
        `;
        
        const updateResult = await pool.query(updateQuery, [reason, id]);
        await updatePartMasterStatuses();

        return res.json({ 
          success: true, 
          message: "✅ Task put ON HOLD",
          status: "on hold",
          on_hold_date: updateResult.rows[0].on_hold_date,
          hold_reason: reason
        });

      case "completed":
        if (currentStatus !== "ongoing") {
          return res.status(400).json({
            success: false,
            message: `⛔ Cannot complete task. Only ONGOING tasks can be completed. Current status: ${currentStatus?.toUpperCase() || "NULL"}`,
          });
        }

        const completedReason = reason || "Task completed successfully";
        const completeQuery = `
          UPDATE assign_task 
          SET 
            status = 'completed', 
            reason = $1,
            actual_end_date = CURRENT_TIMESTAMP,
            on_hold_date = NULL
          WHERE id = $2
          RETURNING status, actual_end_date
        `;
        
        const completeResult = await pool.query(completeQuery, [completedReason, id]);
        await updatePartMasterStatuses();

        return res.json({ 
          success: true, 
          message: "✅ Task marked as COMPLETED", 
          status: "completed", 
          reason: completedReason,
          actual_end_date: completeResult.rows[0].actual_end_date
        });

      case "ongoing":
        if (currentStatus === "ongoing") {
          return res.status(400).json({ 
            success: false, 
            message: "⚠️ Task is already ongoing!" 
          });
        }

        await pool.query(
          `UPDATE assign_task 
           SET status = 'ongoing', 
              reason = NULL,
              on_hold_date = NULL
           WHERE id = $1`,
          [id]
        );
        await updatePartMasterStatuses();

        return res.json({ 
          success: true, 
          message: "✅ Task Accepted & Status Changed to ONGOING!" 
        });

      default:
        return res.status(400).json({ 
          success: false, 
          message: "⚠️ Invalid status" 
        });
    }
  } catch (error) {
    console.error("❌ Error updating job status:", error);
    res.status(500).json({ 
      success: false, 
      message: "🚨 Internal Server Error" 
    });
  }
});

app.post("/forgot-password", async (req, res) => {
  const { employee_id, new_password, confirm_password } = req.body;

  try {
    console.log("Received Request:", { employee_id, new_password, confirm_password });

    if (!employee_id || !new_password || !confirm_password) {
      await logEvent("Forgot Password", `Missing fields for employee ID: ${employee_id}`);
      return res.status(400).json({ message: "All fields are required" });
    }

    const userQuery = "SELECT * FROM employee_master WHERE employee_id = $1";
    const userResult = await pool.query(userQuery, [employee_id]);

    if (userResult.rows.length === 0) {
      console.log("❌ Employee ID not found:", employee_id);
      await logEvent("Forgot Password", `Invalid employee ID: ${employee_id}`);
      return res.status(404).json({ message: "Employee ID not found" });
    }

    if (new_password !== confirm_password) {
      await logEvent("Forgot Password", `Password mismatch for employee ID: ${employee_id}`);
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    const updateQuery = "UPDATE employee_master SET password = $1 WHERE employee_id = $2";
    await pool.query(updateQuery, [hashedPassword, employee_id]);

    console.log("✅ Password reset successful for Employee ID:", employee_id);
    await logEvent("Forgot Password", `Password reset successful for employee ID: ${employee_id}`);
    return res.status(200).json({ message: "Password reset successfully" });

  } catch (error) {
    console.error("🚨 Error resetting password:", error.message);
    await logEvent("Forgot Password", `Error resetting password for employee ID: ${employee_id} - ${error.message}`);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/api/tasks/status/:status', async (req, res) => {
  const { status } = req.params;
  try {
    let queryText = '';
    let queryValues = [];

    if (status === 'finished') {
      // Special case: finished status from part_master
      queryText = `
        SELECT DISTINCT ON (at.id) at.*, wom.priority, 'finished' as status
        FROM assign_task at
        JOIN work_order_master wom ON at.control_number = wom.control_number
        JOIN part_master pm ON pm.part_number = ANY(at.part_number)
        WHERE pm.status = $1
        ORDER BY at.id, wom.priority DESC
      `;
      queryValues.push('finished');
    } else {
      // Normal statuses from assign_task
      queryText = `
        SELECT DISTINCT ON (at.id) at.*, wom.priority
        FROM assign_task at
        JOIN work_order_master wom ON at.control_number = wom.control_number
      `;
      if (status !== 'All') {
        queryText += ' WHERE at.status = $1';
        queryValues.push(status);
      }
      queryText += ' ORDER BY at.id, wom.priority DESC';
    }

    const result = await pool.query(queryText, queryValues);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).send('Internal Server Error');
  }
});

async function updatePartMasterStatuses() {
  const query = `
   UPDATE part_master pm
SET status = stats.new_status
FROM (
    SELECT 
        pm.control_number,
        CASE
            WHEN COUNT(DISTINCT un_part.part_number) = 0 THEN 'not started'
            WHEN COUNT(DISTINCT un_part.part_number) FILTER (WHERE un_part.status = 'completed') = COUNT(DISTINCT pm.part_number) THEN 'completed'
            WHEN COUNT(DISTINCT un_part.part_number) FILTER (WHERE un_part.status = 'ongoing') > 0 THEN 'ongoing'
            WHEN COUNT(DISTINCT un_part.part_number) FILTER (WHERE un_part.status = 'completed') > 0 THEN 'partially completed'
            ELSE 'not started'
        END AS new_status
    FROM part_master pm
    LEFT JOIN (
        SELECT 
            unnest(part_number) AS part_number,
            control_number,
            status
        FROM assign_task
    ) un_part 
    ON pm.part_number = un_part.part_number AND pm.control_number = un_part.control_number
    GROUP BY pm.control_number
) stats
WHERE pm.control_number = stats.control_number
AND pm.status IS DISTINCT FROM stats.new_status
RETURNING pm.control_number, pm.status;

  `;

  try {
    await pool.query(query);
    console.log("✅ part_master statuses updated");
  } catch (err) {
    console.error("❌ Failed to update part_master statuses:", err.message);
  }
}


app.route("/api/control-numbers")
  .get(async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT control_number
        FROM part_master
        GROUP BY control_number
        HAVING NOT bool_and(status = 'finished')
      `);

      const controlNumbers = result.rows.map(row => row.control_number);

      await logEvent("FETCH_CONTROL_NUMBERS", "Fetched available control numbers");

      res.json(controlNumbers);
    } catch (err) {
      console.error("Error fetching control numbers:", err);
      await logEvent("FETCH_CONTROL_NUMBERS_ERROR", `Error: ${err.message}`);
      res.status(500).json({ error: "Failed to fetch control numbers" });
    }
  })



  // PUT: Update selected control number to 'finished'
  .put(async (req, res) => {
    const { control_number } = req.body;

    if (!control_number) {
      await logEvent("UPDATE_CONTROL_NUMBER_FAILED", "Control number not provided");
      return res.status(400).json({ error: "Control number is required" });
    }

    try {
      const result = await pool.query(
        "UPDATE part_master SET status = 'finished' WHERE control_number = $1",
        [control_number]
      );

      if (result.rowCount > 0) {
        await logEvent("CONTROL_NUMBER_UPDATED", `Control number ${control_number} marked as finished`);
        res.json({ success: true, message: "Status updated to finished" });
      } else {
        await logEvent("CONTROL_NUMBER_NOT_FOUND", `Control number ${control_number} not found or already finished`);
        res.status(404).json({ error: "Control number not found or already finished" });
      }
    } catch (err) {
      console.error("Error updating status:", err);
      await logEvent("UPDATE_CONTROL_NUMBER_ERROR", `Error updating ${control_number}: ${err.message}`);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

// Logout endpoint with logging
app.post("/logout", async (req, res) => {
  try {
    // Get employee_id from the request body
    const employeeId = req.body.employee_id || "Unknown Employee";

    await logEvent("LOGOUT", `Employee ${employeeId} logged out`);

    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Error logging out:", error);
    await logEvent("LOGOUT_ERROR", `Error logging out employee: ${error.message}`);
    res.status(500).json({ success: false, message: "Error logging out" });
  }
});

//flutter



app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🌍 API URL: ${API_URL}`);
});

