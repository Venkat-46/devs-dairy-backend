const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const databasePath = path.join(__dirname, 'devdb.db')

const app = express()

app.use(express.json())

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


app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}';`
  const databaseUser = await database.get(selectUserQuery)
  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password,
    )
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

app.get('/logs/:userid', async (request, response) => {
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

app.post('/userlog/:userid', async (request, response) => {
  const {userid}=request.params;
  const {date, yesterday, today, blocker} = request.body
  const postLogsQuery = `
  INSERT INTO userlogs (user_id, date, yesterday, today, blocker)
VALUES
    (${userid}, '${date}', '${yesterday}', '${today}', '${blocker}');`
  await database.run(postLogsQuery)
  response.send('log Successfully Added')
})

app.post(
  '/logs/:userid/:logid',
  async (request, response) => {
    const {userid,logid} = request.params
    const {date, yesterday, today, blocker} = request.body
    const updateLogsQuery = `
  UPDATE
    userlogs
  SET
    date = '${date}',
    yesterday = ${yesterday},
    today = ${today},
    cured = ${cured},
    blocker = ${blocker}
  WHERE
     user_id= ${userid} and id=${logid};
  `
    await database.run(updateLogsQuery)
    response.send('log is updated successfully')
  },
)


module.exports = app