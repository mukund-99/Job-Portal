var express = require("express");
var router = express.Router();
var exe = require("../mysql_connection");




router.get("/",  function(req,res){
    res.render("company/home.ejs");
});




router.get("/companies_register", function(req,res){
    res.render("common/companies_register.ejs");
});



function verifylogin(req, res, next) {
    if (req.session.company_id) {
        next();
    } else {    
        res.redirect('/');
    }
}

router.get("/post_job", verifylogin, (req,res) => {
    res.render("company/post_job.ejs");
});

router.post("/save_job", verifylogin, async (req,res) => {
    var d = req.body;
    var sql = `INSERT INTO jobs (company_id, job_title, job_type, experience_min, experience_max, vacancies, reference_link, skills_required, job_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    var result = await exe(sql, [
        req.session.company_id,
        d.job_title,
        d.job_type,
        d.experience_min,
        d.experience_max,
        d.vacancies,
        d.reference_link,
        d.skills,
        d.job_description
    ]);
    res.redirect('/company/list_jobs');

});



router.get("/list_jobs", verifylogin, async (req, res) => {
  try {
    const company_id = req.session.company_id;

    // Ensure company_id exists in session
    if (!company_id) {
      return res.redirect("/company_login"); // or wherever your login page is
    }

    const sql = `
      SELECT jobs.*,
      (SELECT COUNT(*) FROM applications WHERE applications.job_id = jobs.job_id) AS applicant_count,
      company.company_name, company.company_location
      FROM jobs
      JOIN company ON company.company_id = jobs.company_id
      WHERE jobs.company_id = ?
      ORDER BY jobs.job_id DESC
    `;

    const result = await exe(sql, [company_id]);
    res.render("company/list_jobs.ejs", { result });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.get("/view_applicants/:job_id", verifylogin, async (req, res) => {
    var job_id = req.params.job_id;
    var sql = `
      SELECT applications.*, 
      jobs.job_title,
      employee.employee_name, employee.employee_email, employee.employee_mobile, applications.resume_file
      FROM applications
      JOIN employee ON employee.employee_id = applications.employee_id
      JOIN jobs ON jobs.job_id = applications.job_id
      WHERE applications.job_id = ?
    `;

    const result = await exe(sql, [job_id]);
    res.render("company/view_applicants.ejs", { result });
});



      // --------------------------------------Mail Sending Dyanamic----------------------------------------------------------


// router.get("/shortlist/:application_id", verifylogin, async (req, res) => {
//   try {
//     const { application_id } = req.params;

//     // 1️⃣ Get application + employee info
//     const [application] = await exe(
//       `SELECT a.application_id, e.employee_email, e.employee_name, j.job_title, c.company_name 
//        FROM applications a
//        JOIN employee e ON e.employee_id = a.employee_id
//        JOIN jobs j ON j.job_id = a.job_id
//        JOIN company c ON c.company_id = j.company_id
//        WHERE a.application_id = ?`,
//       [application_id]
//     );

//     if (!application) return res.send("Application not found");

//     // 2️⃣ Update status
//     await exe("UPDATE applications SET application_status = 'shortlisted' WHERE application_id = ?", [application_id]);

//     // 3️⃣ Send dynamic email
//     const subject = `Congratulations! You’ve been shortlisted for ${application.job_title}`;
//     const html = `
//       <p>Dear <b>${application.employee_name}</b>,</p>
//       <p>Good news! 🎉</p>
//       <p>Your application for the position of <b>${application.job_title}</b> has been shortlisted by <b>${application.company_name}</b>.</p>
//       <p>We’ll contact you soon with next steps.</p>
//       <p>Best regards,<br>${application.company_name} Team</p>
//     `;

//     await sendMail(application.employee_email, subject, html);

//     res.send('<script>alert("Applicant shortlisted and mail sent!"); document.location.href=document.referrer;</script>');
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error shortlisting applicant");
//   }
// });

      // -------------------------------------Mail Sending Dyanamic END ------------------------------------------------------


router.get("/shortlist/:application_id", verifylogin, async (req, res) => {
    var application_id = req.params.application_id;
    var sql = "UPDATE applications SET application_status = 'Shortlisted' WHERE application_id = ?";
    var result = await exe(sql, [application_id]);
    res.send('<script>document.location.href = document.referrer;</script>');
});

router.get("/reject/:application_id", verifylogin, async (req, res) => {
    var application_id = req.params.application_id;
    var sql = "UPDATE applications SET application_status = 'Rejected' WHERE application_id = ?";
    var result = await exe(sql, [application_id]);
    res.send('<script>document.location.href = document.referrer;</script>');
});

// router.get("/list_jobs", verifylogin, async (req,res) => {
//     var sql = `SELECT * FROM jobs, company WHERE company.company_id = jobs.company_id`;
//     var result = await exe(sql);
//     var packet = {result}
//     res.render("company/list_jobs.ejs", packet);
// });

router.get("/edit_job/:job_id", verifylogin, async (req,res) => {
    var job_id = req.params.job_id;
    var sql = "SELECT * FROM jobs WHERE job_id = ?";
    var job = await exe(sql, [job_id]);
    var packet = {job};
    res.render("company/edit.ejs" ,packet);
});

router.post("/update_job/:job_id", verifylogin, async (req,res) => {
    var job_id = req.params.job_id;
    var d = req.body;
    var sql = `UPDATE jobs SET job_title = ?, job_category = ?, job_type = ?, experience_min = ?, experience_max = ?, skills_required = ?, vacancies = ?, status = ?, reference_link = ?, job_description = ? WHERE job_id = ?`;

    var result = await exe(sql, [d.job_title, d.job_category, d.job_type, d.experience_min, d.experience_max, d.skills_required, d.vacancies, d.status, d.reference_link, d.details, job_id]);
    res.redirect('/company/list_jobs');
});

router.get("/delete_job/:job_id", verifylogin, async (req,res) => {
    var job_id = req.params.job_id;
    var sql = "DELETE FROM jobs WHERE job_id = ?";
    var result = await exe(sql, [job_id]);
    res.redirect('/company/list_jobs');
});

router.get("/dashboard", verifylogin, async (req, res) => {
    var company_id = req.session.company_id;
    var sql = "SELECT * FROM company WHERE company_id = ?";
    var result = await exe(sql, [company_id]);
    res.render("company/home.ejs", { result: result });
});

router.get("/logout", verifylogin, (req, res) => {
  // Destroy session to log user out
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      res.send("Error logging out");
    } else {
      res.redirect("/"); 
    }
  });
});


module.exports = router;