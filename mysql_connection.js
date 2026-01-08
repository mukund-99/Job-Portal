var mysql = require("mysql2");
var util = require("util");

require('dotenv').config();
console.log('DB HOST:', process.env.HOST);

// Prefer an explicit DB user var to avoid platform differences (USER vs USERNAME)
var dbUser = process.env.DB_USER || process.env.USER || process.env.USERNAME;
if (!dbUser) {
    console.error('Database user not set. Please add DB_USER to your .env (e.g. DB_USER=root)');
    process.exit(1);
}

var conn = mysql.createConnection({
    host: process.env.HOST || 'localhost',
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
});

conn.connect(function(err){
    if (err) {
        console.error('MySQL connection error:', err.message || err);
        // exit so the process doesn't continue in a broken state; nodemon will wait for changes
        process.exit(1);
    } else {
        console.log('MySQL connected as', dbUser);
    }
});

var exe = util.promisify(conn.query).bind(conn);

module.exports = exe;