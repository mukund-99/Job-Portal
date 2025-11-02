var express = require("express");
var router = express.Router();
var exe = require("../mysql_connection");

const { render } = require("ejs");


router.get("/", function(req,res){
    res.render("common/home.ejs");
});

router.get("/companies_register", function(req,res){
    res.render("common/companies_register.ejs");
});



router.post("/save_company" , async function(req,res){

    // res.send(req.body);
    var d = req.body;
    var sql = "INSERT INTO company(company_name, company_location, company_type, industry, hr_name, hr_designation, hr_mobile, hr_email, hr_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

    try {
        var result = await exe(sql, [
            d.companyName,
            d.companyLocation,
            d.companyType,
            d.industry,
            d.hrName,
            d.hrDesignation,
            d.hrMobile,
            d.hrEmail,
            d.hrPassword
        ]);
        res.redirect("/companies_register");
    } catch (err) {
        res.render("common/emailerror.ejs", { error: err });
    }
});

router.post("/company_login",async function(req,res){
    var d = req.body;

    var sql = "SELECT * FROM company WHERE hr_email = ? AND hr_password = ?" ;
    var result = await exe(sql, [d.hrEmail, d.hrPassword]);



    if(result.length > 0) {
        req.session.company_id = result[0].company_id;
        res.render("company/home.ejs", { result: result });
    }else{
        res.send("Invalid");
    }
})


// router.post("/company_login", async function(req,res){
//     var d = req.body;

//     var sql = "SELECT * FROM company WHERE hr_email = ? AND hr_password = ?" ;
//     var result = await exe(sql, [d.hrEmail, d.hrPassword]);

//     var company = "SELECT * FROM company";
//     var result = await exe(company);
//     var packet = {result}

//     if(result.length > 0) {
//         req.session.company_id = result[0].company_id;
//         res.render("company/home.ejs", packet);
//         // console.log(result);
//         // console.log(req.session.company_id);
//     }else{
//         res.send("Invalid");
//     }
// });



module.exports = router;