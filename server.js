import express, { json } from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import passport from "passport";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
// import Key from "./config/key.js";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
// import Attendance from './models/attendance.js';/
import EmployeeUpload from "./models/excelUpload.js";
import { read, utils } from "xlsx";
// import Employee from './models/excelUpload.js';
import nodemailer from "nodemailer";
import crypto from "crypto";
import loginValidate from "./validation/login.js";
import registerValidate from "./validation/register.js";
import LastLogin from "./models/LastLogin.js";
import User from "./models/user.model.js";
import Employee from "./models/excelUpload.js";
import Analyst from "./models/analyst.model.js";
import Billing from "./models/billing.model.js";
import Attendance from "./models/attendance.model.js";

import Task from "./models/task.model.js";
import Manager from "./models/addmanager.model.js";
import Team from "./models/addteam.model.js";
import Status from "./models/status.model.js";
import AddTeam from "./models/addteam.model.js";
// import passport from 'passport';
import passportJwt from "passport-jwt";
import Key from "./config/key.js";
import jwtStrategy from "passport-jwt";
import extractJwt from "passport-jwt"; // Replace with your actual secret key
import moment from "moment";
const app = express();
const port = process.env.PORT || 5000;
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const URI = process.env.ATLAS_URI;

mongoose.connect(
  URI,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  (err) => {
    if (err) throw err;
    console.log("Connected to MongoDB Atlas !!!");
  }
);

app.use(cors());
app.use(express.json({ limit: "5000mb" })); // adjust the limit as needed
app.use(cookieParser());
app.use(express.urlencoded({ limit: "5000mb", extended: false })); // adjust the limit as needed

app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());

const JwtStrategy = passportJwt.Strategy;
const ExtractJwt = passportJwt.ExtractJwt;
const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: Key.key, // Replace with your actual secret key
};

passport.use(
  new JwtStrategy(options, (jwtPayload, done) => {
    // Check if the user exists in the database based on jwtPayload
    // You can query your database to get user details using jwtPayload.sub (user id)

    // Example:
    User.findById(jwtPayload.sub)
      .then((user) => {
        if (user) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      })
      .catch((err) => done(err, false));
  })
);
const authenticateToken = (req, res, next) => {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!user) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Attach the user object to the request
    req.user = user;
    next();
  })(req, res, next);
};
// user.js route
dotenv.config();
const HOST = process.env.SMTP_HOST;
const PORT = process.env.SMTP_PORT;
const USER = process.env.SMTP_USER;
const PASS = process.env.SMTP_PASS;

const determineRoleFromDesignation = (designation) => {
  // Your logic to determine the role based on the designation
  // For example, if designation is "DEV", return "admin"
  // If designation is "SUPERADMIN", return "superadmin"
  // Otherwise, return "analyst"

  const adminDesignations = ["PROJECT MANAGER"];
  const superAdminDesignation = "SUPERADMIN";

  if (adminDesignations.includes(designation.toUpperCase())) {
    return "admin";
  } else if (designation.toUpperCase() === superAdminDesignation) {
    return "superadmin";
  } else {
    return "analyst";
  }
};

app.post("/register", async (req, res) => {
  try {
    const { errors, isValid } = registerValidate(req.body);

    if (!isValid) {
      return res.status(400).json(errors);
    }

    // Check if the email already exists in the user database
    const existingUser = await User.findOne({ email: req.body.email });

    if (existingUser) {
      return res.status(400).json({ emailAlready: "Email already registered" });
    }

    // Check if the email exists in the employee database
    const existingEmployee = await Employee.findOne({
      email_id: req.body.email,
    });

    if (!existingEmployee) {
      return res
        .status(400)
        .json({ emailNotFound: "Email not found in employee database" });
    }

    // Determine the role based on the employee's designation
    const role = determineRoleFromDesignation(existingEmployee.designation);

    // Proceed with user registration
    const newUser = new User({
      name: req.body.name,
      empId: req.body.empId,
      role: role,
      email: req.body.email,
      password: req.body.password,
    });

    // Hash the password before saving it to the database
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(newUser.password, salt, async (err, hash) => {
        if (err) {
          console.log(err);
          throw err;
        }
        newUser.password = hash;

        // Save the new user to the user database
        try {
          const savedUser = await newUser.save();
          res.json(savedUser);
        } catch (error) {
          console.log(error);
          res.status(500).json({ message: "Internal server error" });
        }
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//   const LastLogin = require('../models/LastLogin');

app.post("/login", async (req, res) => {
  try {
    const { errors, isValid } = loginValidate(req.body);

    if (!isValid) {
      return res.status(400).json(errors);
    }

    const email = req.body.email;
    const password = req.body.password;

    // Check if it's the superadmin login
    if (
      email === "superadmin@objectways.com" &&
      password === "superadmin@123"
    ) {
      const payload = {
        id: "superadmin", // You can use a unique identifier for the superadmin
        name: "Super Admin",
        email: "superadmin@objectways.com",
        empId: "superadmin",
        role: "superadmin",
      };

      jwt.sign(
        payload,
        Key.key,
        {
          expiresIn: 900,
        },
        (err, token) => {
          if (err) {
            console.error('JWT Sign Error:', err);
            return res.status(500).json({ message: 'Internal server error' });
          }
      
          console.log("Backend Token:", token);
          res.cookie("token", token, { httpOnly: true, secure: true });
          res.json({
            success: true,
            token: "Bearer " + token,
          });
        }
      );
      
    } else {
      // If it's not a superadmin login, proceed with the existing logic
      const existingEmployee = await Employee.findOne({ email_id: email });

      if (!existingEmployee) {
        return res
          .status(400)
          .json({ emailNotFound: "Email not found in Employee database" });
      }

      User.findOne({ email }).then((user) => {
        if (!user) {
          return res.status(404).json({ emailNotFound: "Email Not Found" });
        }

        const role = determineRoleFromDesignation(existingEmployee.designation);

        bcrypt.compare(password, user.password).then(async (isMatch) => {
          if (isMatch) {
            try {
              const lastLogin = new LastLogin({
                userId: user._id,
                loginTime: new Date(),
              });

              await lastLogin.save();

              user.lastLogin = lastLogin._id;

              await user.save();

              const payload = {
                id: user.id,
                name: user.name,
                email: user.email,
                empId: user.empId,
                role: role,
              };

              jwt.sign(
                payload,
                Key.key,
                {
                  expiresIn: 900,
                },
                (err, token) => {
                  console.log("Backend Token:", token); // Log the token
                  res.cookie("token", token, { httpOnly: true, secure: true }); // Set the token in a cookie
                  res.json({
                    success: true,
                    token: "Bearer " + token,
                  });
                }
              );
            } catch (error) {
              console.error(error);
              res.status(500).json({ message: "Internal server error" });
            }
          } else {
            return res
              .status(400)
              .json({ passwordIncorrect: "Password Incorrect" });
          }
        });
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/users", (req, res) => {
  User.find({}, "name")
    .sort([["name", 1]])
    .then((user) => res.json(user))
    .catch((err) => res.status(400).json("Error:" + err));
});
app.get("/all", (req, res) => {
  User.find({}, "empId")
    .then((user) => res.json(user))
    .catch((err) => res.status(400).json("Error:" + err));
});

app.get("/last-login", async (req, res) => {
  try {
    const lastLogins = await LastLogin.find().populate("userId", "name email"); // Assuming you have a reference to the user in LastLogin model

    res.json(lastLogins);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/reset", (req, res) => {
  const newPass = req.body.password;
  const email = req.body.email;
  const sendToken = req.body.token;

  User.findOne({ resetToken: sendToken, expireToken: { $gt: Date.now() } })
    .then((user) => {
      if (!user) {
        return res
          .status(404)
          .json("Token Has been expired so Please try again");
      }
      bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newPass, salt, (err, hash) => {
          if (err) {
            console.log(err);
          }
          user.password = hash;
          user.resetToken = undefined;
          user.expireToken = undefined;
          user
            .save()
            .then((user) =>
              res.json(
                "Your New Password Has been updated please login with new password"
              )
            )
            .catch((err) => console.log(err));
        });
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

// all employees route

// POST route for uploading data
app.post("/uploadData", async (req, res) => {
  try {
    const data = req.body;

    // Extract email IDs from the incoming data
    const emailIds = data.map((employeeData) => employeeData.email_id);

    // Find existing employees with the extracted email IDs
    const existingEmployees = await Employee.find({
      email_id: { $in: emailIds },
    });

    // Create a map of existing employees for quick access
    const existingEmployeeMap = new Map(
      existingEmployees.map((emp) => [emp.email_id, emp])
    );

    // Prepare an array for bulk insertion
    const bulkInsertData = [];

    for (const employeeData of data) {
      const existingEmployee = existingEmployeeMap.get(employeeData.email_id);

      if (existingEmployee) {
        // Merge existing employee data with the new data
        const mergedData = { ...existingEmployee.toObject(), ...employeeData };
        bulkInsertData.push({
          updateOne: {
            filter: { _id: existingEmployee._id },
            update: mergedData,
          },
        });
      } else {
        // If no existing employee, create a new one
        bulkInsertData.push({ insertOne: { document: employeeData } });
      }
    }

    // Use insertMany for bulk insertion and updating
    await Employee.bulkWrite(bulkInsertData);

    res.status(200).json({ message: "Data saved to MongoDB" });
  } catch (error) {
    console.error("Error saving data to MongoDB", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET route for fetching data
app.get("/fetchData", async (req, res) => {
  try {
    const employees = await Employee.find({});
    const columns = Object.keys(Employee.schema.paths).filter(
      (col) => col !== "_id"
    );
    const rows = employees.map((emp) => ({ ...emp.toObject(), id: emp._id }));

    res.status(200).json({ columns, rows });
  } catch (error) {
    console.error("Error fetching data from MongoDB", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST route for adding an employee
app.post("/addEmployee", async (req, res) => {
  try {
    const newEmployeeData = req.body;
    const newEmployee = new Employee(newEmployeeData);
    await newEmployee.save();

    res.status(200).json({ message: "Employee added successfully" });
  } catch (error) {
    console.error("Error adding employee to MongoDB", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE route for deleting an employee
app.delete("/deleteEmployee/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await Employee.findByIdAndDelete(id);
    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee from MongoDB", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT route for updating an employee
app.put("/updateEmployee/:id", async (req, res) => {
  const { id } = req.params;
  const updatedEmployeeData = req.body;

  try {
    await Employee.findByIdAndUpdate(id, updatedEmployeeData);
    res.status(200).json({ message: "Employee updated successfully" });
  } catch (error) {
    console.error("Error updating employee in MongoDB", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// analyst.js route
app.get("/analyst", async (req, res) => {
  Analyst.find()
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("Error:" + err));
});
app.delete("/delete/usertask/:id", async (req, res) => {
  try {
    // Find the task by ID and delete it
    const result = await Analyst.findByIdAndDelete(req.params.id);

    if (!result) {
      return res.status(404).json({ message: "Record not found" });
    }

    return res.status(200).json({ message: "Record deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

// Fetch teams
app.get("/teams", async (req, res) => {
  try {
    const teams = await Analyst.distinct("team");
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Fetch projects based on team
app.get("/projectNames", async (req, res) => {
  try {
    const { team } = req.query;
    let query = team ? { team } : {};

    const projects = await Analyst.distinct("projectName", query);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/fetch/taskwise", async (req, res) => {
  try {
    const { sDate, eDate, team, projectName } = req.query;

    let matchCondition = {
      dateTask: { $gte: new Date(sDate), $lte: new Date(eDate) },
    };

    if (team) {
      matchCondition.team = team;
    }

    if (projectName) {
      matchCondition.projectName = projectName;
    }

    const result = await Analyst.aggregate([
      {
        $match: matchCondition,
      },
      {
        $unwind: "$sessionOne",
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$dateTask" } },
            task: "$sessionOne.task",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json(result);
  } catch (error) {
    console.error("Error fetching taskwise data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/add", (req, res) => {
  const userData = req.body;
  const newData = new Analyst(userData);
  console.log(userData);
  newData
    .save()
    .then(() => {
      console.log("Data Saved!!!");
      res.json("Data Saved!!!");
    })
    .catch((err) => {
      console.error("Error saving data:", err);
      res.status(400).json("Error: Required all fileds");
    });
});

app.get("/fetch/src/:min/:max", (req, res) => {
  const min = req.params.min;
  const max = req.params.max;
  const qur = { week: { $gte: min, $lte: max } };

  Analyst.find(qur)
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("err" + err));
});

//Fetch individual user Data for users

app.get("/fetch/user-data/", (req, res) => {
  const sDate = req.query.sDate;
  const eDate = req.query.eDate;
  const empId = req.query.empId;
  const team = req.query.team;

  Analyst.find({
    empId: empId,
    team: team,
    createdAt: { $gte: new Date(sDate), $lte: new Date(eDate) },
  })
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("err" + err));
});
app.get("/fetch/userdata/", (req, res) => {
  const empId = req.query.empId;

  Analyst.find({ empId: empId })
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("err" + err));
});

//Fetch report of user particular team

app.get("/fetch/report/", (req, res) => {
  const sDate = req.query.sDate;
  const eDate = req.query.eDate;
  const name = req.query.name;
  const team = req.query.team;

  Analyst.find({
    name: name,
    team: team,
    createdAt: { $gte: new Date(sDate), $lte: new Date(eDate) },
  })
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("err" + err));
});

//Fetch report by team

app.get("/fetch/report/team/", (req, res) => {
  const sDate = req.query.sDate;
  const eDate = req.query.eDate;
  const team = req.query.team;

  Analyst.find({
    team: team,
    createdAt: { $gte: new Date(sDate), $lte: new Date(eDate) },
  })
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("err" + err));
});

//Fetch report by user
app.get("/fetch/report/user/", (req, res) => {
  const sDate = req.query.sDate;
  const eDate = req.query.eDate;
  const name = req.query.name;

  Analyst.find({
    name: name,
    createdAt: { $gte: new Date(sDate), $lte: new Date(eDate) },
  })
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("err" + err));
});

//Fetch Report by date
app.get("/fetch/report/date/", (req, res) => {
  const sDate = req.query.sDate;
  const eDate = req.query.eDate;

  Analyst.find({ createdAt: { $gte: new Date(sDate), $lte: new Date(eDate) } })
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("err" + err));
});
app.get("/fetch/user-data/", (req, res) => {
  const empId = req.params.empId;
  const sDate = req.query.sDate;
  const eDate = req.query.eDate;
  const team = req.query.team;

  const query = {
    empId: empId,
    team: team,
    createdAt: { $gte: new Date(sDate), $lte: new Date(eDate) },
  };

  Analyst.find(query)
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("err" + err));
});

app.get("/fetch", (req, res) => {
  Analyst.find(req.query)
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("Error:" + err));
});
app.delete("/del", (req, res) => {
  Analyst.deleteMany()
    .then(() => res.json("Exercise Deleted!!!!"))
    .catch((err) => res.status(400).json("Error:" + err));
});
app.get("/count", (req, res) => {
  const sDate = req.query.sDate;
  const team = req.query.team;
  const fdate = new Date(sDate);

  Analyst.count({ team: team, createdAt: { $gte: new Date(sDate) } })
    .then((analyst) => res.json(analyst))
    .catch((err) => res.status(400).json("Error:" + err));
});

app.get("/fetch/one", (req, res) => {
  const date = req.query.createdAt;
  const empId = "710";
  Analyst.find({ empId: empId, createdAt: { $gte: new Date(date) } })
    .then((analyst) => {
      if (analyst) {
        return res.status(404).json({
          emailnotfound:
            "Already Your file has been submitted please try to Submit tomorrow",
        });
      }
      return null;
    })
    .catch((err) => res.status(400).json("Error:" + err));
});

// billing routes

//Find All Data in Billing
app.get("/billing", (req, res) => {
  const empId = req.query.empId;
  Billing.find({ empId: empId })
    .sort([["reportDate", 1]])
    .then((billing) => res.json(billing))
    .catch((err) => res.status(400).json("Error:" + err));
});
// //Find All Data in Billing
app.get("/admin", (req, res) => {
  Billing.find()
    .sort([["reportDate", 1]])
    .then((billing) => res.json(billing))
    .catch((err) => res.status(400).json("Error:" + err));
});
// Assuming you have a route like this in your Express app
app.get("/projectStatus", async (req, res) => {
  try {
    const projectStatusData = await Billing.aggregate([
      {
        $group: {
          _id: "$jobs.status1",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status1: "$_id",
          count: 1,
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]);

    res.json(projectStatusData);
  } catch (error) {
    console.error("Error fetching project status data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/status1CountByProject", async (req, res) => {
  try {
    const status1CountByProject = await Billing.aggregate([
      {
        $group: {
          _id: { projectname: "$projectname", status1: "$jobs.status1" },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.projectname",
          status1Counts: {
            $push: { status1: "$_id.status1", count: "$count" },
          },
        },
      },
    ]);

    res.json(status1CountByProject);
  } catch (error) {
    console.error("Error fetching status1 count by project:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Find by Id
app.get("/billing/:id", (req, res) => {
  Billing.findById(req.params.id)
    .then((billing) => res.json(billing))
    .catch((err) => res.status(400).json("Error:" + err));
});

//Add new Billing Data
app.post("/new", (req, res) => {
  const name = req.body;
  const newData = new Billing(name);
  console.log(name);
  newData
    .save()
    .then(() => res.json("Data Saved Successfully !!!"))
    .catch((err) => res.status(400).json("Error:" + err));
});

// edit Billing Data
app.post("/update/:id", (req, res) => {
  const data = req.body;
  Billing.findByIdAndUpdate(req.params.id, data)
    .then(() => res.json("Updated"))
    .catch((err) => res.status(400).json("Error:" + err));
});

//Delete Billing Data By Id
app.delete("/billing/:id", (req, res) => {
  Billing.findByIdAndDelete(req.params.id)
    .then(() => res.json("Exercise Has been Deleted "))
    .catch((err) => res.status(400).json("Error:" + err));
});

//Find Billing Data By date
app.get("/fetch/date/", (req, res) => {
  const sDate = new Date(req.query.sDate);
  const eDate = new Date(req.query.eDate);

  Billing.find({ reportDate: { $gte: sDate, $lte: eDate } })
    .then((billing) => res.json(billing))
    .catch((err) => res.status(400).json("err" + err));
});

//Find Billing Data by Date & team
app.get("/fetch/report/", (req, res) => {
  const sDate = new Date(req.query.sDate);
  const eDate = new Date(req.query.eDate);
  const team = req.query.team;

  Billing.find({ team: team, reportDate: { $gte: sDate, $lte: eDate } })
    .then((billing) => res.json(billing))
    .catch((err) => res.status(400).json("err" + err));
});

//attendatnce.js route

// Fetch all attendance data
app.get("/emp-attendance", (req, res) => {
  Attendance.find()
    .then((attendance) => res.json(attendance))
    .catch((err) => res.status(400).json("Error:" + err));
});
app.get("/compareData", async (req, res) => {
  try {
    // Fetch data from API one (Employee data)
    const employees = await Employee.find({});
    const totalEmployees = employees.length;

    // Fetch data from API two (Attendance data)
    const attendanceData = await Attendance.find({});
    const presentEmployees = attendanceData.length;

    // Calculate the absent employees
    // const absentEmployees = totalEmployees - presentEmployees;

    // Prepare data for the response
    const comparisonData = {
      totalEmployees,
      presentEmployees,
      // absentEmployees,
    };

    res.status(200).json(comparisonData);
  } catch (error) {
    console.error("Error comparing data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// Save attendance data
app.post("/att", async (req, res) => {
  try {
    const { name, empId, checkInTime, checkOutTime, total } = req.body;

    // Capture the current date
    const currentDate = new Date();

    const newAttendance = new Attendance({
      name,
      empId,
      checkInTime,
      checkOutTime,
      total,
      currentDate,
    });

    await newAttendance.save();
    res.json("Data Saved!!!");
  } catch (error) {
    res.status(400).json("Error:" + error);
  }
});

app.get("/fetch/att-data/", (req, res) => {
  const empId = req.query.empId;
  Attendance.find({ empId: empId })
    .sort({ currentDate: -1 }) // Sort by currentDate in descending order
    .select("checkInTime checkOutTime total currentDate") // Select only specific fields
    .then((attendance) => res.json(attendance))
    .catch((err) => res.status(400).json("err" + err));
});

//task.js route

//add task
app.get("/fetch/task-data", (req, res) => {
  Task.find()
    .then((task) => res.json(task))
    .catch((err) => res.status(400).json("Error:" + err));
});

app.post("/task/new", async (req, res) => {
  try {
    const { createTask } = req.body;

    const newTask = new Task({
      createTask,
    });

    await newTask.save();
    res.json("Task Added!!!");
  } catch (error) {
    res.status(400).json("Error:" + error);
  }
});

//add manager
app.get("/fetch/manager-data", (req, res) => {
  Manager.find()
    .then((manager) => res.json(manager))
    .catch((err) => res.status(400).json("Error:" + err));
});

app.post("/add-manager/new", async (req, res) => {
  try {
    const { createManager } = req.body;

    const newManager = new Manager({
      createManager,
    });

    await newManager.save();
    res.json("Manager Added!!!");
  } catch (error) {
    res.status(400).json("Error:" + error);
  }
});

//add team
app.get("/fetch/addteam-data", (req, res) => {
  AddTeam.find()
    .then((addteam) => res.json(addteam))
    .catch((err) => res.status(400).json("Error:" + err));
});

app.post("/add-team/new", async (req, res) => {
  try {
    const { createTeam } = req.body;

    const newTeam = new AddTeam({
      createTeam,
    });

    await newTeam.save();
    res.json("Team Added!!!");
  } catch (error) {
    res.status(400).json("Error:" + error);
  }
});

//add status
app.get("/fetch/status-data", (req, res) => {
  Status.find()
    .then((status) => res.json(status))
    .catch((err) => res.status(400).json("Error:" + err));
});

app.post("/add-status/new", async (req, res) => {
  try {
    const { createStatus } = req.body;

    const newStatus = new Status({
      createStatus,
    });

    await newStatus.save();
    res.json("Status Added!!!");
  } catch (error) {
    res.status(400).json("Error:" + error);
  }
});

//delete funtions
// Delete task
app.delete("/delete/task/:id", async (req, res) => {
  try {
    const taskId = req.params.id;
    await Task.findByIdAndDelete(taskId);
    res.json("Task Deleted!!!");
  } catch (error) {
    res.status(400).json("Error:" + error);
  }
});

// Delete manager
app.delete("/delete/manager/:id", async (req, res) => {
  try {
    const managerId = req.params.id;
    await Manager.findByIdAndDelete(managerId);
    res.json("Manager Deleted!!!");
  } catch (error) {
    res.status(400).json("Error:" + error);
  }
});

// Delete team
app.delete("/delete/team/:id", async (req, res) => {
  try {
    const teamId = req.params.id;
    await AddTeam.findByIdAndDelete(teamId);
    res.json("Team Deleted!!!");
  } catch (error) {
    res.status(400).json("Error:" + error);
  }
});

app.use(express.static(path.join(__dirname, "client/build")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "/client/build", "index.html"));
});

// app.get("/get-token", authenticateToken, (req, res) => {
//   // Access user details through req.user
//   console.log("Backend Token:", req.token);
//   res.json({ message: "This is a protected route", user: req.user });
// });

// app.use(express.static(path.join(__dirname, 'public')));

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

app.listen(port, () => {
  console.log(`Server Running On Port : ${port}`);
});

export const handler = async (event, context) => {
  try {
    const headers = event.headers || {};
    const tokenHeader = headers.authorization || headers.Authorization;

    if (!tokenHeader) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "http://localhost:3000",
          "Access-Control-Allow-Credentials": true,
          "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PUT, DELETE",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        body: JSON.stringify({
          error: "Unauthorized - Missing Authorization header",
        }),
      };
    }

    const token = tokenHeader.split(" ")[1];

    if (!token) {
      return {
        statusCode: 401,
        headers: {
          "Access-Control-Allow-Origin": "http://localhost:3000",
          "Access-Control-Allow-Credentials": true,
          "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PUT, DELETE",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        body: JSON.stringify({
          error: "Unauthorized - Malformed Authorization header",
        }),
      };
    }

    const decoded = jwt.verify(token, "key");
    console.log("Decoded token:", decoded);

    // Your existing code here...
const corsOption={
  origin: "http://localhost:3000",
  methods: "POST, OPTIONS, GET, PUT, DELETE",
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: "Content-Type,Authorization"
}
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
      body: JSON.stringify({
        message: isListening
          ? "Server running on Lambda"
          : "Failed to start server",
        status: isListening
          ? "Connected to MongoDB Atlas"
          : "Failed to connect to MongoDB Atlas",
      }),
    };
  } catch (error) {
    console.error("Error verifying token:", error);
    return {
      statusCode: 401,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }
};
