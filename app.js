const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const cors = require('cors');
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const databasePath = path.join(__dirname, 'devdb.db')


const app = express()

app.use(cors());
app.use(express.json())

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});


let database = null

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })

    app.listen(3001, () =>
      console.log('Server Running at http://localhost:3001/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const convertStateDbObjectToResponseObject = dbObject => {
  return {
    userId: dbObject.id,
    userName: dbObject.username,
    email: dbObject.email,
  }
}




app.post('/signup', async (request, response) => {
  try {
    const { username, email, password, role  } = request.body;

    const existingUser = await database.get(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );

    if (existingUser) {
      return response.status(400).send("Email already registered");
    }

    const postUsersQuery = `
      INSERT INTO users (username, email, password, role )
      VALUES (?, ?, ?, ?);
    `;

    await database.run(postUsersQuery, [
      username, email, password, role 
    ]);

    response.status(201).json({ message: "User successfully added" });
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Error adding user" }); 
  }
});



app.post('/login/', async (request, response) => {
  const {username, password, role} = request.body
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}';`
  const databaseUser = await database.get(selectUserQuery)
  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = password===databaseUser.password;
    if (databaseUser.role===role){
      if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken,userid:databaseUser.id})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
    }else{
      response.status(400)
      response.send('Invalid role')
    }
  }
})



app.get('/users/', async (request, response) => {
  const getStatesQuery = `
    SELECT
      *
    FROM
      users;`
  const usersArray = await database.all(getStatesQuery)
  response.send(
    usersArray.map(each =>
      convertStateDbObjectToResponseObject(each),
    ),
  )
})

app.get('/users/:userid', async (request, response) => {
  try {
    const { userid } = request.params;

    if (isNaN(userid)) {
      return response.status(400).send({ error: "Invalid user ID" });
    }

    const getUserQuery = `SELECT * FROM users WHERE id = ?;`;

    const user = await database.get(getUserQuery, [userid]);

    if (!user) {
      return response.status(404).send({ error: "User not found" });
    }

    response.status(200).send(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    response.status(500).send({ error: "Internal server error" });
  }
});



app.get('/userlogs/:userid', async (request, response) => {
  const {userid}=request.params;
  console.log("userid:",userid)
  const getStatesQuery = `
    SELECT
      *
    FROM
      userlogs
      where user_id=${userid};`
  const logsArray = await database.all(getStatesQuery)
  response.send(
    logsArray)
  
})

app.get('/userlogs/:userid/:logid', async (request, response) => {
  try {
    const { userid, logid } = request.params;
    console.log(userid,logid)

    const getLogQuery = `
      SELECT *
      FROM userlogs
      WHERE user_id = ? AND id = ?;
    `;

    const log = await database.get(getLogQuery, [userid, logid]);

    if (!log) {
      return response.status(404).send({ message: "Log not found" });
    }

    response.send(log);
  } catch (error) {
    console.error("Error fetching log:", error);
    response.status(500).send({ message: "Error fetching log" });
  }
});

app.post('/userlogs/:userid', async (request, response) => {
  try {
    const { userid } = request.params;
    const { date, yesterday, today, blocker } = request.body;

    const postLogsQuery = `
      INSERT INTO userlogs (user_id, date, yesterday, today, blocker)
      VALUES (?, ?, ?, ?, ?);
    `;

    await database.run(postLogsQuery, [
      userid,
      date,
      yesterday,
      today,
      blocker
    ]);

    response.send('Log successfully added');
  } catch (error) {
    console.error(error);
    response.status(500).send('Error adding log');
  }
});


app.delete('/userlogs/delete/:userid/:logid', async (request, response) => {
  try {
    const { userid, logid } = request.params;
    const deleteLogQuery = `
      DELETE FROM userlogs
      WHERE user_id = ? AND id = ?;
    `;

    const result = await database.run(deleteLogQuery, [userid, logid]);

    if (result.changes === 0) {
      return response.status(404).json({ message: "Log not found" });
    }

    response.status(200).json({ message: "Log successfully deleted" });
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Error deleting log" });
  }
});


app.post('/userlogs/update/:userid/:logid', async (request, response) => {
  try {
    const { userid, logid } = request.params;
    const { date, yesterday, today, blocker } = request.body;

    const updateLogsQuery = `
      UPDATE userlogs
      SET date = ?, yesterday = ?, today = ?, blocker = ?
      WHERE user_id = ? AND id = ?;
    `;

    await database.run(updateLogsQuery, [
      date,
      yesterday,
      today,
      blocker,
      userid,
      logid
    ]);

    response.json({ message: "Log is updated successfully" });
  } catch (error) {
    console.error(error);
    response.status(500).send('Error updating log');
  }
});



module.exports = app
