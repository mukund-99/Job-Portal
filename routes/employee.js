var express = require("express");
var router = express.Router();
var exe = require("../mysql_connection");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create separate folders
const createFolder = (folderPath) => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
};

// Configure storage for each file type
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = '';
        
        // Handle known field names. Accept both "resume" and "resume_file" used in different forms.
        if (file.fieldname === 'profile_photo') {
            uploadPath = './public/profilephoto';
        } else if (file.fieldname === 'resume' || file.fieldname === 'resume_file') {
            uploadPath = './public/resume';
        } else if (file.fieldname === 'transcript') {
            uploadPath = './public/transcript';
        } else {
            // fallback to resume folder for any other file-looking field
            uploadPath = './public/uploads';
        }
        
        createFolder(uploadPath);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Create unique filename: employee_id + timestamp + original extension
        const uniqueSuffix = req.session.employee_id + '-' + Date.now();
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'profile_photo') {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed for profile photo'), false);
        }
    } else if (file.fieldname === 'resume' || file.fieldname === 'resume_file') {
        if (file.mimetype === 'application/pdf' || 
            file.mimetype === 'application/msword' || 
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and Word documents are allowed for resume'), false);
        }
    } else if (file.fieldname === 'transcript') {
        if (file.mimetype === 'application/pdf' || 
            file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and image files are allowed for transcript'), false);
        }
    } else {
        cb(new Error('Unexpected field'), false);
    }
};
 
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        files: 5,                     // allow up to 5 files
        fileSize: 10 * 1024 * 1024,   // 10MB per file (safe upper bound)
        fields: 200,                  // allow many form fields
        parts: 1000,                  // total parts (fields + files)
        fieldSize: 5 * 1024 * 1024    // max size for a non-file field (5MB) — projects_data can be large
    }
});
 
// Middleware for handling multiple files
const uploadMiddleware = upload.fields([
    { name: 'profile_photo', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'resume_file', maxCount: 1 }, // accept resume_file used by job-apply form
    { name: 'transcript', maxCount: 1 }
]);
 
// Remove duplicate exe declaration (you have it twice)
// var exe = require("../mysql_connection"); // Remove this line

const { render } = require("ejs");
const e = require("express");



router.get("/employee_signin", (req,res) => {
    res.render("employee/employee_signin.ejs");
});

router.post("/employee_signin", async (req,res) => {
    var d = req.body;
    var sql = "INSERT INTO employee (employee_name, employee_email, employee_mobile, employee_password) VALUES (?, ?, ?, ?)";
    var result = await exe(sql, [d.employee_name, d.employee_email, d.employee_mobile, d.employee_password]);
    res.redirect("/employee/employee_login")
})

router.get("/employee_login",  (req, res) => {
   res.render("employee/employee_signin.ejs");
});

router.post("/employee_login", async (req,res) => {
    var d = req.body;
    var sql = "SELECT * FROM employee WHERE employee_email = ? AND employee_password = ?";
    var employee = await exe(sql,  [d.employee_mail, d.employee_password]);

    if(employee.length > 0) {
        req.session.employee_id = employee[0].employee_id;
        console.log("✅ Employee logged in:", req.session.employee_id);
        res.redirect("/employee");
    }else{
        res.send("Invalid");
    }
})

var verify_login = (req,res,next) => {
    if(req.session.employee_id){
        next();
    }else{
        res.redirect("/employee/employee_signin")
    }
}

router.get("/", verify_login, async function (req, res) {
    try {
        var sql = "SELECT * FROM employee WHERE employee_id = ?";
        var employee = await exe(sql, [req.session.employee_id]);

        // var jobQuery = `
        //     SELECT jobs.
        //     *,(SELECT COUNT(*) FROM applications WHERE applications.job_id = jobs.job_id AND applications.employee_id = ?) AS application_count,
        //      company.company_name, company.company_location
        //     FROM jobs
        //     JOIN company ON jobs.company_id = company.company_id ORDER BY job_id DESC
        // `;
        // var jobs = await exe(jobQuery, [req.session.employee_id]);

        var jobQuery = `
    SELECT 
        jobs.*,
        (SELECT COUNT(*) 
            FROM applications 
            WHERE applications.job_id = jobs.job_id 
            AND applications.employee_id = ?) AS has_applied,

        (SELECT COUNT(*) 
            FROM saved_jobs 
            WHERE saved_jobs.job_id = jobs.job_id 
            AND saved_jobs.employee_id = ?) AS has_saved,
        company.company_name, 
        company.company_location
    FROM jobs
    JOIN company ON jobs.company_id = company.company_id 
    ORDER BY job_id DESC
`;
var jobs = await exe(jobQuery, [req.session.employee_id, req.session.employee_id , req.session.employee_id]);



var sql = `
    SELECT COUNT(*) AS total_applied_jobs
    FROM applications
    WHERE employee_id = ?
`;
var result = await exe(sql, [req.session.employee_id]);
console.log("Total applied jobs:", result[0].total_applied_jobs);
var jobs = jobs.map(job => ({
    ...job,
    total_applied_jobs: result[0].total_applied_jobs
}));

var savedQuery = `
    SELECT COUNT(*) AS total_saved 
    FROM saved_jobs 
    WHERE employee_id = ?
`;
var savedResult = await exe(savedQuery, [req.session.employee_id]);
var total_saved = savedResult[0].total_saved;



        var profileCompletePercent = 0;
        if (employee[0].employee_name){ profileCompletePercent += 12.5; }
        if (employee[0].employee_email){ profileCompletePercent += 12.5; }
        if (employee[0].employee_mobile){ profileCompletePercent += 12.5; }
        if (employee[0].skills){ profileCompletePercent += 12.5; }
        var sql = "SELECT * FROM education WHERE employee_id = ?";
        var education = await exe(sql, [req.session.employee_id]);

        if (education.length > 0) { profileCompletePercent += 50; }

        res.render("employee/home.ejs", { employee, jobs, profileCompletePercent, total_saved });
    } catch (err) {
        console.log("Error fetching data:", err);
        res.send("Something went wrong");
    }
});

router.get("/profile", verify_login, async (req,res) => {
    try {
        var sql = "SELECT * FROM employee WHERE employee_id = ?";
        var employee = await exe(sql, [req.session.employee_id]);

        var profileCompletePercent = 0;
        if (employee[0].employee_name){ profileCompletePercent += 12.5; }
        if (employee[0].employee_email){ profileCompletePercent += 12.5; }
        if (employee[0].employee_mobile){ profileCompletePercent += 12.5; }
        if (employee[0].skills){ profileCompletePercent += 12.5; }

        var eduSql = "SELECT * FROM education WHERE employee_id = ?";
        var education = await exe(eduSql, [req.session.employee_id]);
        if (education.length > 0) { profileCompletePercent += 50; }

        // Fetch projects and experience
        var projects = await exe("SELECT * FROM project WHERE employee_id = ?", [req.session.employee_id]);
        var experience = await exe("SELECT * FROM experience WHERE employee_id = ?", [req.session.employee_id]);

        // Attach to employee object used by the template
        employee[0].education = education.length > 0 ? education[0] : {};
        employee[0].skills = employee[0].skills ? employee[0].skills.split(',') : [];
        employee[0].projects = projects || [];
        employee[0].experience = experience || [];

        // Render template (template expects employee[0].projects and employee[0].experience)
        return res.render("employee/profile.ejs", { employee, profileCompletePercent });
    } catch (err) {
        console.error("Error fetching profile data:", err && err.stack ? err.stack : err);
        return res.status(500).send("Something went wrong while loading profile");
    }
});


router.get('/dashboard', verify_login, (req, res) => {
    res.redirect('/employee');
});


// Use explicit upload call so we can catch parser errors like "Unexpected end of form"
// router.post("/save_profile", verify_login, (req, res) => {
//     // Diagnostic: ensure client sent a multipart/form-data request
//     const contentType = req.headers['content-type'] || '';
//     const contentLength = req.headers['content-length'] || '(unknown)';
//     console.log('[DEBUG] /save_profile headers:', {
//         host: req.headers.host,
//         contentType,
//         contentLength
//     });
    
//     if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
//         // Most common cause of "Unexpected end of form" is that the request
//         // wasn't sent as multipart. Return a clear message for debugging.
//         console.error('[ERROR] Request Content-Type is not multipart/form-data.');
//         return res.status(400).send('Bad Request: expected multipart/form-data');
//     }

//     uploadMiddleware(req, res, async function (err) {
//         if (err) {
//             // Log full error for debugging (including busboy errors)
//             console.error("Upload middleware error:", err && err.stack ? err.stack : err);

//             // Provide informative response body so client can surface the cause
//             if (err instanceof multer.MulterError) {
//                 if (err.code === "LIMIT_FILE_SIZE") return res.status(400).send("File too large");
//                 if (err.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).send("Unexpected file field");
//                 // fallback for other multer errors
//                 return res.status(400).send(`Multer error: ${err.code || err.message}`);
//             }

//             // busboy or other parsing errors (e.g. "Unexpected end of form")
//             return res.status(400).send(err.message || "Upload parsing error");
//         }

//         // At this point multipart parsing succeeded — req.files and req.body available
//         try {
//             console.log("=== DEBUG START ===");
//             console.log("Session:", req.session && req.session.employee_id ? req.session.employee_id : req.session);
//             console.log("Files:", req.files);
//             console.log("Body keys:", Object.keys(req.body));
//             console.log("=== DEBUG END ===");

//             const d = req.body;

//             // Handle file paths
//             let profilePhotoPath = null;
//             let resumePath = null;
//             let transcriptPath = null;

//             if (req.files) {
//                 if (req.files["profile_photo"] && req.files["profile_photo"][0]) {
//                     profilePhotoPath = "/profilephoto/" + req.files["profile_photo"][0].filename;
//                 }
//                 if (req.files["resume"] && req.files["resume"][0]) {
//                     resumePath = "/resume/" + req.files["resume"][0].filename;
//                 }
//                 if (req.files["transcript"] && req.files["transcript"][0]) {
//                     transcriptPath = "/transcript/" + req.files["transcript"][0].filename;
//                 }
//             }

//             // UPDATE employee table (fixed column names and parameter order)
//             var sql = `UPDATE employee SET
//                 profile_photo = ?, 
//                 employee_name = ?, 
//                 current_designation = ?, 
//                 employee_email = ?, 
//                 employee_mobile = ?, 
//                 employee_dob = ?, 
//                 gender = ?, 
//                 employee_address = ?, 
//                 employee_pincode = ?, 
//                 summary = ?, 
//                 skills = ?, 
//                 employee_resume = ?
//                 WHERE employee_id = ?`;

//             var employee_dob = null;
//             if (d.employee_dob && d.employee_dob.trim() !== "") {
//                 employee_dob = new Date(d.employee_dob);
//             }

//             const updateParams = [
//                 profilePhotoPath,
//                 d.employee_name || null,
//                 d.current_designation || null,
//                 d.employee_email || null,
//                 d.employee_mobile || null,
//                 employee_dob,
//                 d.gender || null,
//                 d.employee_address || null,
//                 d.employee_pincode || null,
//                 d.summary || null,
//                 d.skills || null,
//                 resumePath || null,
//                 req.session.employee_id
//             ];

//             // Debug: log param presence (avoid printing raw sensitive data)
//             console.log('[DEBUG] Updating employee with params lengths/types:', updateParams.map(p => (p === null ? 'null' : (typeof p) + ':' + (p && p.toString ? p.toString().length : 0))));
//             await exe(sql, updateParams);

//             // Handle education (upsert)
//             // Handle education (upsert)
//             var eduSql = "SELECT * FROM education WHERE employee_id = ?";
//             var education = await exe(eduSql, [req.session.employee_id]);
//             if (education.length > 0) {
//                 var updateEduSql = `UPDATE education SET
//                     degree = ?, 
//                     institution = ?,
//                     field_of_study = ?,
//                     cgpa_percentage = ?,
//                     start_date = ?,
//                     end_date = ?,
//                     education_description = ?,
//                     portfolio_link = ?,
//                     linkedin_profile = ?,
//                     github_profile = ?
//                     WHERE employee_id = ?`;

//                 var educationParams = [
//                     d.degree || null,
//                     d.institution || null,
//                     d.field_of_study || null,
//                     d.cgpa || null,
//                     d.education_start || null,
//                     d.education_end || null,
//                     d.education_description || null,
//                     d.portfolio || null,
//                     d.linkedin || null,
//                     d.github || null,
//                     req.session.employee_id
//                 ];

//                 await exe(updateEduSql, educationParams);
//             } else {
//                 var insertEduSql = `INSERT INTO education 
//                     (employee_id, degree, institution, field_of_study, cgpa_percentage, start_date, end_date, education_description, portfolio_link, linkedin_profile, github_profile) 
//                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//                 var insertEduParams = [
//                     req.session.employee_id,
//                     d.degree || null,
//                     d.institution || null,
//                     d.field_of_study || null,
//                     d.cgpa || null,
//                     d.education_start || null,
//                     d.education_end || null,
//                     d.education_description || null,
//                     d.portfolio || null,
//                     d.linkedin || null,
//                     d.github || null
//                 ];

//                 await exe(insertEduSql, insertEduParams);
//             }
//             res.redirect("/employee/profile");
//         } catch (error) {
//             console.error("Error saving profile:", error && error.stack ? error.stack : error);
//             res.status(500).send("Internal Server Error");
//         }   
//     });
// });



// router.post("/save_profile", verify_login, (req, res) => {
//     const contentType = req.headers['content-type'] || '';
//     const contentLength = req.headers['content-length'] || '(unknown)';
//     console.log('[DEBUG] /save_profile headers:', {
//         host: req.headers.host,
//         contentType,
//         contentLength
//     });
    
//     if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
//         console.error('[ERROR] Request Content-Type is not multipart/form-data.');
//         return res.status(400).send('Bad Request: expected multipart/form-data');
//     }

//     uploadMiddleware(req, res, async function (err) {
//         if (err) {
//             console.error("Upload middleware error:", err && err.stack ? err.stack : err);
//             if (err instanceof multer.MulterError) {
//                 if (err.code === "LIMIT_FILE_SIZE") return res.status(400).send("File too large");
//                 if (err.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).send("Unexpected file field");
//                 return res.status(400).send(`Multer error: ${err.code || err.message}`);
//             }
//             return res.status(400).send(err.message || "Upload parsing error");
//         }

//         try {
//             console.log("=== DEBUG START ===");
//             console.log("Session:", req.session && req.session.employee_id ? req.session.employee_id : req.session);
//             console.log("Files:", req.files);
//             console.log("Body keys:", Object.keys(req.body));
//             console.log("=== DEBUG END ===");

//             const d = req.body;

//             // Handle file paths - only set when new files are uploaded
//             let profilePhotoPath = null;
//             let resumePath = null;
//             let transcriptPath = null;

//             if (req.files) {
//                 if (req.files["profile_photo"] && req.files["profile_photo"][0]) {
//                     profilePhotoPath = "/profilephoto/" + req.files["profile_photo"][0].filename;
//                 }
//                 if (req.files["resume"] && req.files["resume"][0]) {
//                     resumePath = "/resume/" + req.files["resume"][0].filename;
//                 }
//                 if (req.files["transcript"] && req.files["transcript"][0]) {
//                     transcriptPath = "/transcript/" + req.files["transcript"][0].filename;
//                 }
//             }

//             // UPDATE employee table (fixed column names and parameter order)
//             var sql = `UPDATE employee SET
//                 profile_photo = ?, 
//                 employee_name = ?, 
//                 current_designation = ?, 
//                 employee_email = ?, 
//                 employee_mobile = ?, 
//                 employee_dob = ?, 
//                 gender = ?, 
//                 employee_address = ?, 
//                 employee_pincode = ?, 
//                 summary = ?, 
//                 skills = ?, 
//                 employee_resume = ?
//                 WHERE employee_id = ?`;

//             var employee_dob = null;
//             if (d.employee_dob && d.employee_dob.trim() !== "") {
//                 employee_dob = new Date(d.employee_dob);
//             }

//             const updateParams = [
//                 profilePhotoPath,
//                 d.employee_name || null,
//                 d.current_designation || null,
//                 d.employee_email || null,
//                 d.employee_mobile || null,
//                 employee_dob,
//                 d.gender || null,
//                 d.employee_address || null,
//                 d.employee_pincode || null,
//                 d.summary || null,
//                 d.skills || null,
//                 resumePath || null,
//                 req.session.employee_id
//             ];

//             // Debug: log param presence (avoid printing raw sensitive data)
//             console.log('[DEBUG] Updating employee with params lengths/types:', updateParams.map(p => (p === null ? 'null' : (typeof p) + ':' + (p && p.toString ? p.toString().length : 0))));
//             await exe(sql, updateParams);

//             // Handle education (upsert)
//             // Handle education (upsert)
//             var eduSql = "SELECT * FROM education WHERE employee_id = ?";
//             var education = await exe(eduSql, [req.session.employee_id]);
//             if (education.length > 0) {
//                 var updateEduSql = `UPDATE education SET
//                     degree = ?, 
//                     institution = ?,
//                     field_of_study = ?,
//                     cgpa_percentage = ?,
//                     start_date = ?,
//                     end_date = ?,
//                     education_description = ?,
//                     portfolio_link = ?,
//                     linkedin_profile = ?,
//                     github_profile = ?
//                     WHERE employee_id = ?`;

//                 var educationParams = [
//                     d.degree || null,
//                     d.institution || null,
//                     d.field_of_study || null,
//                     d.cgpa || null,
//                     d.education_start || null,
//                     d.education_end || null,
//                     d.education_description || null,
//                     d.portfolio || null,
//                     d.linkedin || null,
//                     d.github || null,
//                     req.session.employee_id
//                 ];

//                 await exe(updateEduSql, educationParams);
//             } else {
//                 var insertEduSql = `INSERT INTO education 
//                     (employee_id, degree, institution, field_of_study, cgpa_percentage, start_date, end_date, education_description, portfolio_link, linkedin_profile, github_profile) 
//                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

//                 var insertEduParams = [
//                     req.session.employee_id,
//                     d.degree || null,
//                     d.institution || null,
//                     d.field_of_study || null,
//                     d.cgpa || null,
//                     d.education_start || null,
//                     d.education_end || null,
//                     d.education_description || null,
//                     d.portfolio || null,
//                     d.linkedin || null,
//                     d.github || null
//                 ];

//                 await exe(insertEduSql, insertEduParams);
//             }
//             res.redirect("/employee/profile");
//         } catch (error) {
//             console.error("Error saving profile:", error && error.stack ? error.stack : error);
//             res.status(500).send("Internal Server Error");
//         }   
//     });
// });



router.post("/save_profile", verify_login, (req, res) => {
    const contentType = req.headers['content-type'] || '';
    const contentLength = req.headers['content-length'] || '(unknown)';
    console.log('[DEBUG] /save_profile headers:', {
        host: req.headers.host,
        contentType,
        contentLength
    });
    
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
        console.error('[ERROR] Request Content-Type is not multipart/form-data.');
        return res.status(400).send('Bad Request: expected multipart/form-data');
    }

    uploadMiddleware(req, res, async function (err) {
        if (err) {
            console.error("Upload middleware error:", err && err.stack ? err.stack : err);
            if (err instanceof multer.MulterError) {
                if (err.code === "LIMIT_FILE_SIZE") return res.status(400).send("File too large");
                if (err.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).send("Unexpected file field");
                return res.status(400).send(`Multer error: ${err.code || err.message}`);
            }
            return res.status(400).send(err.message || "Upload parsing error");
        }

        try {
            console.log("=== DEBUG START ===");
            console.log("Session:", req.session && req.session.employee_id ? req.session.employee_id : req.session);
            console.log("Files:", req.files);
            console.log("Body keys:", Object.keys(req.body));
            console.log("=== DEBUG END ===");

            const d = req.body;

            // Handle file paths - only set when new files are uploaded
            let profilePhotoPath = null;
            let resumePath = null;
            let transcriptPath = null;

            if (req.files) {
                if (req.files["profile_photo"] && req.files["profile_photo"][0]) {
                    profilePhotoPath = "/profilephoto/" + req.files["profile_photo"][0].filename;
                }
                if (req.files["resume"] && req.files["resume"][0]) {
                    resumePath = "/resume/" + req.files["resume"][0].filename;
                }
                if (req.files["transcript"] && req.files["transcript"][0]) {
                    transcriptPath = "/transcript/" + req.files["transcript"][0].filename;
                }
            }

            // Build dynamic UPDATE query based on which files were uploaded
            let updateFields = [];
            let updateParams = [];

            // Only include profile_photo if a new one was uploaded
            if (profilePhotoPath) {
                updateFields.push("profile_photo = ?");
                updateParams.push(profilePhotoPath);
            }

            // Always update these fields
            updateFields.push("employee_name = ?");
            updateParams.push(d.employee_name || null);
            
            updateFields.push("current_designation = ?");
            updateParams.push(d.current_designation || null);
            
            updateFields.push("employee_email = ?");
            updateParams.push(d.employee_email || null);
            
            updateFields.push("employee_mobile = ?");
            updateParams.push(d.employee_mobile || null);
            
            updateFields.push("employee_dob = ?");
            let employee_dob = null;
            if (d.employee_dob && d.employee_dob.trim() !== "") {
                employee_dob = new Date(d.employee_dob);
            }
            updateParams.push(employee_dob);
            
            updateFields.push("gender = ?");
            updateParams.push(d.gender || null);
            
            updateFields.push("employee_address = ?");
            updateParams.push(d.employee_address || null);
            
            updateFields.push("employee_pincode = ?");
            updateParams.push(d.employee_pincode || null);
            
            updateFields.push("summary = ?");
            updateParams.push(d.summary || null);
            
            updateFields.push("skills = ?");
            updateParams.push(d.skills || null);

            // Only include employee_resume if a new one was uploaded
            if (resumePath) {
                updateFields.push("employee_resume = ?");
                updateParams.push(resumePath);
            }

            // Add WHERE condition
            updateParams.push(req.session.employee_id);

            // Build the final SQL query
            var sql = `UPDATE employee SET ${updateFields.join(", ")} WHERE employee_id = ?`;

            console.log('[DEBUG] Update SQL:', sql);
            console.log('[DEBUG] Update params:', updateParams.map(p => (p === null ? 'null' : (typeof p) + ':' + (p && p.toString ? p.toString().length : 0))));
            
            await exe(sql, updateParams);

            // Handle education (upsert)
            // Handle education (upsert) - FIXED: Preserve existing portfolio, github, linkedin values
var eduSql = "SELECT * FROM education WHERE employee_id = ?";
var existingEducation = await exe(eduSql, [req.session.employee_id]);

if (existingEducation.length > 0) {
    // Use existing values if new values are not provided
    const currentEdu = existingEducation[0];
    
    var updateEduSql = `UPDATE education SET
        degree = ?, 
        institution = ?,
        field_of_study = ?,
        cgpa_percentage = ?,
        start_date = ?,
        end_date = ?,
        education_description = ?,
        upload_transcript = ?,
        portfolio_link = ?,
        linkedin_profile = ?,
        github_profile = ?
        WHERE employee_id = ?`;

    var educationParams = [
        d.degree || currentEdu.degree,
        d.institution || currentEdu.institution,
        d.field_of_study || currentEdu.field_of_study,
        d.cgpa || currentEdu.cgpa_percentage,
        d.education_start || currentEdu.start_date,
        d.education_end || currentEdu.end_date,
        d.education_description || currentEdu.education_description,
        transcriptPath || currentEdu.upload_transcript,
        d.portfolio || currentEdu.portfolio_link,      // Preserve existing if not provided
        d.linkedin || currentEdu.linkedin_profile,     // Preserve existing if not provided
        d.github || currentEdu.github_profile,         // Preserve existing if not provided
        req.session.employee_id
    ];

    await exe(updateEduSql, educationParams);
} else {
    var insertEduSql = `INSERT INTO education 
        (employee_id, degree, institution, field_of_study, cgpa_percentage, start_date, end_date, education_description, upload_transcript, portfolio_link, linkedin_profile, github_profile) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    var insertEduParams = [
        req.session.employee_id,
        d.degree || null,
        d.institution || null,
        d.field_of_study || null,
        d.cgpa || null,
        d.education_start || null,
        d.education_end || null,
        d.education_description || null,
        transcriptPath || null,
        d.portfolio || null,
        d.linkedin || null,
        d.github || null
    ];

    await exe(insertEduSql, insertEduParams);
}

// ✅ NEW: Handle Projects
if (d.projects_data) {
    try {
        const projects = JSON.parse(d.projects_data);
        
        // Delete existing projects for this employee
        await exe("DELETE FROM project WHERE employee_id = ?", [req.session.employee_id]);
        
        // Insert new projects
        for (const project of projects) {
            if (project.project_title && project.project_title.trim() !== '') {
                const insertProjectSql = `INSERT INTO project 
                    (employee_id, project_title, project_description, technologies_used, github_link, start_date, end_date) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`;
                
                await exe(insertProjectSql, [
                    req.session.employee_id,
                    project.project_title,
                    project.project_description || null,
                    project.technologies_used || null,
                    project.github_link || null,
                    project.start_date || null,
                    project.end_date || null
                ]);
            }
        }
        console.log(`[DEBUG] Saved ${projects.length} projects`);
    } catch (error) {
        console.error("Error saving projects:", error);
    }
}

// ✅ NEW: Handle Experience
if (d.experience_data) {
    try {
        const experiences = JSON.parse(d.experience_data);
        
        // Delete existing experience for this employee
        await exe("DELETE FROM experience WHERE employee_id = ?", [req.session.employee_id]);
        
        // Insert new experience
        for (const exp of experiences) {
            if (exp.position && exp.position.trim() !== '') {
                const insertExpSql = `INSERT INTO experience 
                    (employee_id, position, company, start_date, end_date, description) 
                    VALUES (?, ?, ?, ?, ?, ?)`;
                
                await exe(insertExpSql, [
                    req.session.employee_id,
                    exp.position,
                    exp.company || null,
                    exp.start_date || null,
                    exp.end_date || null,
                    exp.description || null
                ]);
            }
        }
        console.log(`[DEBUG] Saved ${experiences.length} experience entries`);
    } catch (error) {
        console.error("Error saving experience:", error);
    }
}

            res.redirect("/employee/profile");
        } catch (error) {
            console.error("Error saving profile:", error && error.stack ? error.stack : error);
            res.status(500).send("Internal Server Error");
        }   
    });
});

router.get('/save_job/:job_id', verify_login, async (req,res) => {
    var job_id = req.params.job_id;
    var employee_id = req.session.employee_id;
    var sql = `INSERT INTO saved_jobs (employee_id, job_id) VALUES (?, ?)`;
    await exe(sql,[employee_id,job_id]);
    res.send("<script> location.href = document.referrer; </script>");
});
router.get('/unsave_job/:job_id', verify_login, async (req,res) => {
    var job_id = req.params.job_id;
    var employee_id = req.session.employee_id;
    var sql = `DELETE FROM saved_jobs WHERE employee_id = ? AND job_id = ?`;
    await exe(sql,[employee_id,job_id]);
    res.send("<script> location.href = document.referrer; </script>");
});

// router.post("/apply_job", verify_login, async (req,res) => {
//     var job_id = req.body.job_id;
//     var employee_id = req.session.employee_id;
//     var filename = Date.now() + ".pdf";
//     req.files.resume_file.mv("public/resume/ " + filename);
//     var sql = `INSERT INTO application (employee_id, job_id, resume_file) VALUES (?, ?, ?)`;
//     var result = await exe(sql, [employee_id, job_id, filename]);
//     // console.log(filename);
//     res.send(result)
// })


// Use multer single-file handler for job application resume (field name: resume_file)
router.post("/apply_job", verify_login, (req, res) => {
    // use multer single-file parsing for field 'resume_file'
    const single = upload.single('resume_file');
    single(req, res, async function (err) {
        if (err) {
            console.error("Upload error on apply_job:", err);
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).send('Resume file too large');
            }
            return res.status(400).send(err.message || 'Upload error');
        }

        try {
            console.log("Apply job - body:", req.body);
            console.log("Apply job - file:", req.file);

            const job_id = req.body.job_id;
            const employee_id = req.session.employee_id;
            if (!req.file) {
                return res.status(400).send("No resume file uploaded");
            }

            // req.file.filename was set by multer storage
            const filename = req.file.filename;

            // Adjust table name if your DB uses 'application' instead of 'applications'
            var sql = "INSERT INTO applications (employee_id, job_id, resume_file) VALUES (?, ?, ?)";
            var result = await exe(sql, [employee_id, job_id, filename]);
            res.send("<script> location.href = document.referrer; </script>")
        } catch (err2) {
            console.error("Apply Job Error:", err2 && err2.stack ? err2.stack : err2);
            return res.status(500).send("Error while applying for job");
        }
    });
});

router.get("/applied_jobs", verify_login, async (req,res) => {
    try {

         var sql = "SELECT * FROM employee WHERE employee_id = ?";
        var employee = await exe(sql, [req.session.employee_id]);

        var profileCompletePercent = 0;
        if (employee[0].employee_name){ profileCompletePercent += 12.5; }
        if (employee[0].employee_email){ profileCompletePercent += 12.5; }
        if (employee[0].employee_mobile){ profileCompletePercent += 12.5; }
        if (employee[0].skills){ profileCompletePercent += 12.5; }

        var eduSql = "SELECT * FROM education WHERE employee_id = ?";
        var education = await exe(eduSql, [req.session.employee_id]);
        if (education.length > 0) { profileCompletePercent += 50; }

        // Fetch projects and experience
        var projects = await exe("SELECT * FROM project WHERE employee_id = ?", [req.session.employee_id]);
        var experience = await exe("SELECT * FROM experience WHERE employee_id = ?", [req.session.employee_id]);

        // Attach to employee object used by the template
        employee[0].education = education.length > 0 ? education[0] : {};
        employee[0].skills = employee[0].skills ? employee[0].skills.split(',') : [];
        employee[0].projects = projects || [];
        employee[0].experience = experience || [];





        var sql = `
            SELECT applications.*, jobs.job_title, company.company_name, company.company_location
            FROM applications
            JOIN jobs ON applications.job_id = jobs.job_id
            JOIN company ON jobs.company_id = company.company_id
            WHERE applications.employee_id = ?
            ORDER BY applications.application_id DESC
        `;

        var applications = await exe(sql, [req.session.employee_id]);
        res.render("employee/applied_jobs.ejs", { applications, employee, profileCompletePercent });
    } catch (err) {
        console.error("Error fetching applied jobs:", err && err.stack ? err.stack : err);
        res.status(500).send("Something went wrong while loading applied jobs");
    }
});

router.get("/cancel_application/:job_id", verify_login, async (req,res) => {
    try {
        var job_id = req.params.job_id;
        var sql = "DELETE FROM applications WHERE job_id = ? AND employee_id = ?";
        await exe(sql, [job_id, req.session.employee_id]);
        res.redirect("/employee/applied_jobs");
    } catch (err) {
        console.error("Error cancelling application:", err && err.stack ? err.stack : err);
        res.status(500).send("Something went wrong while cancelling application");
    }
});

router.get("/saved_jobs", verify_login, async (req, res) => {
  try {

        var sql = "SELECT * FROM employee WHERE employee_id = ?";
        var employee = await exe(sql, [req.session.employee_id]);

        var profileCompletePercent = 0;
        if (employee[0].employee_name){ profileCompletePercent += 12.5; }
        if (employee[0].employee_email){ profileCompletePercent += 12.5; }
        if (employee[0].employee_mobile){ profileCompletePercent += 12.5; }
        if (employee[0].skills){ profileCompletePercent += 12.5; }

        var eduSql = "SELECT * FROM education WHERE employee_id = ?";
        var education = await exe(eduSql, [req.session.employee_id]);
        if (education.length > 0) { profileCompletePercent += 50; }

        // Fetch projects and experience
        var projects = await exe("SELECT * FROM project WHERE employee_id = ?", [req.session.employee_id]);
        var experience = await exe("SELECT * FROM experience WHERE employee_id = ?", [req.session.employee_id]);

        // Attach to employee object used by the template
        employee[0].education = education.length > 0 ? education[0] : {};
        employee[0].skills = employee[0].skills ? employee[0].skills.split(',') : [];
        employee[0].projects = projects || [];
        employee[0].experience = experience || [];


    const employeeId = req.session.employee_id;

    const query = `
      SELECT 
        jobs.job_id,
        jobs.job_title,
        company.company_name,
        company.company_location,
        saved_jobs.saved_jobs_id,
        saved_jobs.employee_id,
        saved_jobs.saved_at
      FROM saved_jobs
      JOIN jobs ON saved_jobs.job_id = jobs.job_id
      JOIN company ON jobs.company_id = company.company_id
      WHERE saved_jobs.employee_id = ?
      ORDER BY saved_jobs.saved_jobs_id DESC
    `;

    const savedJobs = await exe(query, [employeeId]);
    res.render("employee/saved_jobs.ejs", { savedJobs , employee, profileCompletePercent });
  } catch (error) {
    console.error(error);
    res.send("Error fetching saved jobs");
  }
});


router.get("/logout", verify_login, (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

module.exports = router;