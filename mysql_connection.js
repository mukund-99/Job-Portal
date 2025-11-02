var mysql = require("mysql2");
var util = require("util");

require('dotenv').config();
console.log(process.env.HOST);

var conn = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
});

var exe = util.promisify(conn.query).bind(conn);

module.exports = exe;