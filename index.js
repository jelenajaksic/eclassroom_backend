let express = require("express");
let mongoose = require("mongoose");
const GridFsBucket=require('mongodb').GridFSBucket
const { Schema } = require("mongoose");
const port = 8080;
const app = express();
const nodemailer = require("nodemailer");
const passwordGenerator = require('generate-password');
const ObjectID = require('mongodb').ObjectId;

const crypto = require('crypto');
const multer = require('multer');
const Grid = require('gridfs-stream')
const GridFsStorage = require('multer-gridfs-storage').GridFsStorage;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect("mongodb://localhost/eclassroom", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

let db = mongoose.connection;

let gfs, gfsBucket;

mongoose.connection.on('open', err => {
    gfsBucket = new GridFsBucket(db, {
        bucketName: "uploads"
    });
    gfs = Grid(db, mongoose.mongo);
    gfs.collection('uploads')
})

/**
 * Create storage engine
 * @type {GridFsStorage}
 */
const storage = new GridFsStorage({
    url: "mongodb://localhost/eclassroom",
    file: (req, file) => {
        console.log('file', file)
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                // const filename = buf.toString('hex') + path.extname(file.originalname)
                const fileInfo = {
                    filename: file.originaname,
                    bucketName: 'uploads'
                };
                resolve(fileInfo);
            });
        });
    }
});

const upload = multer({ storage });

/**
 * UserModel
 */
const UserModel = mongoose.model('users', new Schema({
    email: String,
    password: String,
    admin: Boolean,
    name: String,
    linkedUsers: Array
}));

/**
 * CourseModel
 */
const CourseModel = mongoose.model('courses', new Schema({
    admin: String,
    description: String,
    image: String,
    lessons: Array,
    tests: Array,
    shortDescription: String,
    slug: String,
    students: Array,
    title: String,
}));

/**
 * ImageModel
 */
const Image = mongoose.model('Image', new Schema({
    filename: {
        required: true,
        type: String,
    },
    fileId: {
        required: true,
        type: String,
    },
    createdAt: {
        default: Date.now(),
        type: Date,
    },
}));

/**
 * nodemailer config
 * create reusable transporter object using the default SMTP transport
 */
const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'lance68@ethereal.email', // ethereal user
        pass: 'rsBKHp446u4uMybZeZ', // ethereal password
    },
});

const sender = "\"Eclassroom\" <support@example.com>"

/**
 * API route '/image'
 */
app.post('/image', upload.single('file'), (req, res, next) => {
        console.log(req.body.filename);
        // check for existing images
        Image.findOne({ filename: req.body.filename })
            .then((image) => {
                console.log(image);
                if (image) {
                    return res.status(200).json({
                        success: false,
                        message: 'Image already exists',
                    });
                }

                let newImage = new Image({
                    // caption: req.body.caption,
                    filename: req.body.filename,
                    fileId: req.file.id,
                });

                newImage.save()
                    .then((image) => {

                        res.status(200).json({
                            success: true,
                            image,
                        });
                    })
                    .catch(err => res.status(500).json(err));
            })
            .catch(err => res.status(500).json(err));
    });

/**
 * API route '/files'
 */
app.get('/files', (req, res) => {
        console.log('tu sam sam', req.query);
    Image.findOne({ filename: req.query.filename }).then((image)=>{
        if (!image) {
            return res.status(200).json({
                success: false,
                message: 'Image already exists',
            });
        }
        gfs.files.findOne({ _id: new ObjectID(image.fileId) }, (err, file) => {
            // Check if files exist
            if (!file || file.length === 0) {
                return res.status(404).json({
                    err: 'No files exist'
                });
            }

            // Check if image extension is valid
            if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {

                //Creating Readstream
                const readstream = gfsBucket.openDownloadStream(file._id);
                readstream.pipe(res);
            }
            else {
                res.status(404).json({
                    err: 'Not an Image'
                });
            }

        });
    })

});

/**
 * API route '/login'
 */
app.post("/login", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    try {
        const resp = await UserModel.findOne({ email: email }).exec();

        if (!resp) {
            return res.status(401).send({
                message: 'We don\'t know who you are.'
            });
        }
        if (resp.password === password) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(resp));
        } else {
            return res.status(400).send({
                message: 'Incorrect password.'
            });
        }
    } catch {
        return res.status(500);
    }
});

/**
 * API route '/reset-password'
 */
app.post("/reset-password", async (req, res) => {
    const email = req.body.email;

    const password = passwordGenerator.generate({
        length: 10,
        numbers: true
    });

    try {
        const resp = await UserModel.findOne({ email: email }).exec();
        if (!resp) {
            return res.status(401).send({
                message: 'We don\'t know who you are.'
            });
        } else  {
            db.collection("users").updateOne({email: email}, {$set:{password: password}});
        }

        const msg = {
            from: sender, // sender address
            to: `${email}`, // list of receivers
            subject: "Reset password", // Subject line
            text: `Hi ${resp.name}, \n\n Your new password for Eclassroom is: ${password}.\n\n Please change your password after the login. \n\n Regards, Eclassroom`, // plain text body
        };
        // send mail with defined transport object
        const info = await transporter.sendMail(msg);
        console.log("Message sent: %s", info.messageId);
        // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

        res.status(200).send({
            message: 'Password changed.'
        });
    } catch (e) {
        res.status(500);
    }
});

/**
 * API route '/get-all-users'
 */
app.post("/get-all-users", async (req, res) => {

    try {
        const resp = await UserModel.find({}).exec();

        if (!resp) {
            res.status(500)
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(resp));
        }
    } catch (e) {
        return res.status(500);
    }
});

/**
     * API route '/update-user-info'
 */
app.post("/update-user-info", async (req, res) => {
    const user = {
        _id: new ObjectID(req.body.id),
        email: req.body.email,
        password: req.body.password,
        name: req.body.name,
        admin: req.body.admin
    };
    try {
        db.collection("users").updateOne({_id: user._id}, {$set:{name: user.name}})
        db.collection("users").updateOne({_id: user._id}, {$set:{email: user.email}})
        db.collection("users").updateOne({_id: user._id}, {$set:{password: user.password}})
        const resp = await UserModel.findOne({ email: user.email }).exec();
        if (!resp) {
            res.status(400).send({
                message: 'Something went wrong. Please try again'
            });
        } else {
            res.status(200).send({
                message: 'User info successfully updated.'
            });
        }
    } catch (e) {
        res.status(500)
    }
});

/**
 * API route '/courses/get-all'
 */
app.post("/courses/get-all", async (req, res) => {

    try {
        const resp = await CourseModel.find({}).exec();

        if (!resp) {
            res.status(500)
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(resp));
        }
    } catch (e) {
        return res.status(500);
    }
});

/**
 * API route '/courses/add-course'
 */
app.post("/courses/add-course", async (req, res) => {
    const { course } = req.body

    try {
        const resp = await CourseModel.findOne({ slug: course.slug }).exec();

        if (!resp) {
            db.collection("courses")
                .insertOne(course, function (err, result) {
                    if (err) {
                        res.status(400).send({
                            message: 'Error inserting course.'
                        });
                    } else {
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(result.insertedId));
                    }
                });
        } else {
            res.status(400).send({
                message: 'Course with this name already exists.'
            });
        }
    } catch (e) {
        return res.status(500);
    }
});

/**
 * API route '/courses/delete-course'
 */
app.post("/courses/delete-course", async (req, res) => {
    const query = { _id: new ObjectID(req.body.id) };

    try {
        const resp = await CourseModel.findOne(query).exec();

        if (resp) {
            db.collection("courses")
                .deleteOne(query, function (err, _result) {
                    if (err) {
                        res.status(400).send({
                            message: 'Error deleting course.'
                        });
                    } else {
                        res.status(200).send({
                            message: 'One document deleted.'
                        });
                    }
                });
        } else {
            res.status(400).send({
                message: 'Something went wrong. Please try again.'
            });
        }
    } catch (e) {
        return res.status(500);
    }
});

/**
 * API route '/courses/update-course'
 */
app.post("/courses/update-course", async (req, res) => {
    const query = { _id: new ObjectID(req.body.id) };
    const course = {
        title: req.body.title,
        slug: req.body.slug,
        description: req.body.description,
        shortDescription: req.body.shortDescription,
        image: req.body.image
    };
    try {
        db.collection("courses").updateOne(query, {$set:{title: course.title}})
        db.collection("courses").updateOne(query, {$set:{slug: course.slug}})
        db.collection("courses").updateOne(query, {$set:{description: course.description}})
        db.collection("courses").updateOne(query, {$set:{shortDescription: course.shortDescription}})
        db.collection("courses").updateOne(query, {$set:{image: course.image}})

        const resp = await CourseModel.findOne(query).exec();
        if (!resp) {
            res.status(400).send({
                message: 'Something went wrong. Please try again'
            });
        } else {
            res.status(200).send({
                message: 'Course successfully edited.'
            });
        }
    } catch (e) {
        res.status(500)
    }
});

/**
 * API route '/courses/add-student'
 */
app.post("/courses/add-student", async (req, res) => {
    const adminEmail = req.body.adminEmail;
    const user = {
        email: req.body.email,
        password: passwordGenerator.generate({
            length: 10,
            numbers: true
        }),
        name: req.body.name,
        admin: false,
        linkedUsers: [ adminEmail ]
    };

    const query = { _id: new ObjectID(req.body.course_id) };

    try {
        const resp = await UserModel.findOne({ email: user.email }).exec();

        if (!resp) {
            // Add new user to users
            db.collection("users")
                .insertOne(user, function (err, result) {
                    if (err) {
                        res.status(400).send({
                            message: 'Error inserting users.'
                        });
                    }
                });
            // add new user to courses
            const course = await CourseModel.findOne(query).exec();

            if (course.lessons.length > 0) {
                const studentsLessons = {
                    [user.email]: "0",
                    ...course.lessons[0].students
                };
                db.collection("courses").updateMany(query, {$set: { "lessons.$[].students": studentsLessons }});
            }

            if (course.tests.length > 0) {
                const studentsTests = {
                    [user.email]: "0",
                    ...course.tests[0].students
                };
                db.collection("courses").updateMany(query, {$set: { "tests.$[].students": studentsTests }});
            }

            if (!course.students.includes(user.email)) {
                const students = [user.email, ...course.students];
                db.collection("courses").updateOne(query, {$set: { students: students }});
            }

            // link to admin
            const admin = await UserModel.findOne({ email: adminEmail }).exec();
            const linkedUsersAdmin = admin.linkedUsers.length > 0 ? [ ...admin.linkedUsers, user.email ] : [ user.email ];
            db.collection("users").updateOne({ email: adminEmail }, {$set: { linkedUsers: linkedUsersAdmin }});

            // Send email with new password to new user
            const respNew = await UserModel.findOne({ email: user.email }).exec();

            const msg = {
                from: sender, // sender address
                to: `${user.email}`, // list of receivers
                subject: "Welcome to Eclassroom", // Subject line
                text: `Hi ${respNew.name}, \n\n Your password for Eclassroom is: ${respNew.password}.\n\n Please change your password after the login. \n\n Regards, Eclassroom`, // plain text body
            };
            // send mail with defined transport object
            const info = await transporter.sendMail(msg);
            console.log("Message sent: %s", info.messageId);

            res.status(200).send({
                message: 'Added a new student.'
            });
        } else {
            res.status(400).send({
                message: 'User with this email already exists.'
            });
        }
    } catch (e) {
        return res.status(500);
    }
});

/**
 * API route '/courses/enroll-student'
 */
app.post("/courses/enroll-student", async (req, res) => {
    const email = req.body.email
    const query = { _id: new ObjectID(req.body.course_id) };

    try {
        const resp = await UserModel.findOne({ email: email }).exec();

        if (resp) {
            // add existing user to courses
            const course = await CourseModel.findOne(query).exec();

            if (course.lessons.length > 0) {
                const studentsLessons = {
                    ...course.lessons[0].students,
                    [email]: "0"
                };
                db.collection("courses").updateMany(query, {$set: { "lessons.$[].students": studentsLessons }});
            }

            if (course.tests.length > 0) {
                const studentsTests = {
                    ...course.tests[0].students,
                    [email]: "0"
                };
                db.collection("courses").updateMany(query, {$set: { "tests.$[].students": studentsTests }});
            }

            if (!course.students.includes(email)) {
                const students = [ ...course.students, email ];
                db.collection("courses").updateOne(query, {$set: { students: students }});
            }

            // link to admin if not previously linked
            const admin = await UserModel.findOne({ email: course.admin }).exec();
            if (!admin.linkedUsers.includes(email)) {
                const linkedUsersAdmin = [ ...admin.linkedUsers, email ];
                db.collection("users").updateOne({ email: admin.email }, {$set: { linkedUsers: linkedUsersAdmin }});
            }

            res.status(200).send({
                message: 'Student enrolled.'
            });
        } else {
            res.status(400).send({
                message: 'Something went wrong. Please try again later.'
            });
        }
    } catch (e) {
        return res.status(500);
    }
});

/**
 * API route '/courses/add-lesson'
 */
app.post("/courses/add-lesson", async (req, res) => {
    const query = { _id: new ObjectID(req.body.course_id) };
    const lesson = req.body.lesson;

    try {
        db.collection("courses").updateOne(query, {$push:{ lessons: lesson }})

        res.status(200).send({
            message: 'Lesson successfully added.'
        });
    } catch (e) {
        res.status(500).send({
            message: 'Something went wrong. Please try again'
        });
    }
});

/**
 * API route '/courses/update-lesson'
 */
app.post("/courses/update-lesson", async (req, res) => {
    const query = { _id: new ObjectID(req.body.course_id) };
    const lesson = req.body.lesson;

    try {
        db.collection("courses").updateOne(query, { $pull: { lessons: { _id: lesson._id } } }, false, true);
        db.collection("courses").updateOne(query, {$push:{ lessons: lesson }})

        res.status(200).send({
            message: 'Lesson successfully added.'
        });
    } catch (e) {
        res.status(500).send({
            message: 'Something went wrong. Please try again'
        });
    }
});

/**
 * API route '/courses/delete-lesson'
 */
app.post("/courses/delete-lesson", async (req, res) => {
    const query = { _id: new ObjectID(req.body.course_id) };
    const lessonID = req.body.lesson_id;

    try {
        db.collection("courses").updateOne(query, { $pull: { lessons: { _id: lessonID } } }, false, true);
        res.status(200).send({
            message: 'Lesson successfully deleted.'
        });
    } catch (e) {
        res.status(500).send({
            message: 'Something went wrong. Please try again'
        });
    }
});

/**
 * API route '/courses/add-test'
 */
app.post("/courses/add-test", async (req, res) => {
    const query = { _id: new ObjectID(req.body.course_id) };
    const newTest = req.body.newTest;

    try {
        db.collection("courses").updateOne(query, {$push:{ tests: newTest }})

        res.status(200).send({
            message: 'Test successfully added.'
        });
    } catch (e) {
        res.status(500).send({
            message: 'Something went wrong. Please try again'
        });
    }
});

/**
 * API route '/courses/update-test'
 */
app.post("/courses/update-test", async (req, res) => {
    const query = { _id: new ObjectID(req.body.course_id) };
    const newTest = req.body.newTest;

    try {
        db.collection("courses").updateOne(query, { $pull: { tests: { _id: newTest._id } } }, false, true);
        db.collection("courses").updateOne(query, {$push:{ tests: newTest }})

        res.status(200).send({
            message: 'Test successfully added.'
        });
    } catch (e) {
        res.status(500).send({
            message: 'Something went wrong. Please try again'
        });
    }
});

/**
 * API route '/courses/delete-test'
 */
app.post("/courses/delete-test", async (req, res) => {
    const query = { _id: new ObjectID(req.body.course_id) };
    const testID = req.body.test_id;

    try {
        db.collection("courses").updateOne(query, { $pull: { tests: { _id: testID } } }, false, true);
        res.status(200).send({
            message: 'Test successfully deleted.'
        });
    } catch (e) {
        res.status(500).send({
            message: 'Something went wrong. Please try again'
        });
    }
});

/**
 * API route '/courses/update-current-lesson-section'
 */
app.post("/courses/update-current-lesson-section", async (req, res) => {
    const query = { _id: new ObjectID(req.body.course_id) };
    const lessonID = req.body.lesson_id;
    const section = req.body.sectionIndex
    const student = req.body.studentEmail

    try {
        const resp = await CourseModel.findOne(query).exec();

        if (resp) {
            const students = resp.lessons.find(lesson => lesson._id === lessonID).students
            students[student] = section

            const updateDocument = {
                $set: { "lessons.$[lesson].students": students }
            };
            const options = {
                arrayFilters: [{
                    "lesson._id": lessonID,
                }]
            };
            db.collection("courses").updateOne(query, updateDocument, options);

            res.status(200).send({
                message: 'Progress successfully updated.'
            });
        } else {
            res.status(400).send({
                message: 'Something went wrong. Please try again.'
            });
        }
    } catch (e) {
        res.status(500).send({
            message: 'Something went wrong. Please try again.'
        });
    }
});

/**
 * API route '/courses/update-test-progress'
 */
app.post("/courses/update-test-progress", async (req, res) => {
    const query = { _id: new ObjectID(req.body.course_id) };
    const testID = req.body.test_id;
    const score = req.body.score
    const student = req.body.studentEmail

    try {
        const resp = await CourseModel.findOne(query).exec();

        if (resp) {
            const students = resp.tests.find(test => test._id === testID).students
            students[student] = score

            const updateDocument = {
                $set: { "tests.$[test].students": students }
            };
            const options = {
                arrayFilters: [{
                    "test._id": testID,
                }]
            };
            db.collection("courses").updateOne(query, updateDocument, options);

            res.status(200).send({
                message: 'Progress successfully updated.'
            });
        } else {
            res.status(400).send({
                message: 'Something went wrong. Please try again.'
            });
        }
    } catch (e) {
        res.status(500).send({
            message: 'Something went wrong. Please try again.'
        });
    }
});

app.listen(port, () => {
    console.log('Radi');
});


