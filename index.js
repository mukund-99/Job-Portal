var express = require("express");
var bodyparser = require("body-parser");
var session = require("express-session");

var app = express();

app.use(express.static("public/"));
// IMPORTANT: Do NOT register global multipart parsers (like express-fileupload or bodyparser for multipart)
// so multer can parse multipart/form-data correctly in routes.
app.use((req, res, next) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (ct.startsWith('multipart/form-data')) return next();
  return bodyparser.urlencoded({ extended: true })(req, res, next);
});

app.use(session({
  secret: "mukund",
  resave: false,
  saveUninitialized: false
}));

app.use("/", require("./routes/common"));
app.use("/employee", require("./routes/employee"));
app.use("/company", require("./routes/company"));
app.use("/admin", require("./routes/admin"));

app.use('/profilephoto', express.static('public/profilephoto'));
app.use('/resume', express.static('public/resume'));
app.use('/transcript', express.static('public/transcript'));

app.listen(process.env.PORT || 1100);
