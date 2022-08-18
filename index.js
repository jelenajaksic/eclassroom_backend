let express = require("express");
let mongoose = require("mongoose");
const {Schema} = require("mongoose");
const port = 8080;
const app = express();
app.get("/", (req, res) => {
    res.send("Kidamo bre");
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect("mongodb://localhost/eclassroom", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

let db = mongoose.connection;

const UserModel = mongoose.model('users', new Schema({
    email: String,
    password: String,
    admin: Boolean,
    name: String,
}));

const CourseModel = mongoose.model('courses', new Schema({
    admin: String,
    description: String,
    image: String,
    lessons: Array,
    short_description: String,
    slug: String,
    students: Object,
    title: String,
}));
// const UserDoc = new UserModel({ email: 'email', password: 'password' });
// UserDoc.save();

// API route '/login'
app.post("/login", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    // var res = db.collection("users").findOne(email);
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
    return res.status(500);
});

// API route '/reset-password'
app.post("/reset-password", async (req, res) => {
    // const email = req.body.email;
    return res.status(200);
});

// API route '/get-all-users'
app.post("/get-all-users", async (req, res) => {

    const resp = await UserModel.find({}).exec();

    if (!resp) {
        res.status(500)
    } else {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(resp));
    }
    return res.status(500);
});

// API route '/courses/get_all'
app.post("/courses/get_all", async (req, res) => {

    const resp = await CourseModel.find({}).exec();

    if (!resp) {
        res.status(500)
    } else {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(resp));
    }
    return res.status(500);
});

// API route '/update-user-info'
app.post("/update-user-info", async (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password,
        name: req.body.name,
        admin: req.body.admin
    };

    const resp = await UserModel.findOne({ email: user.email }).exec();

    if (!resp) {
        db.collection("users")
            .insertOne(user, function (err, result) {
                if (err) {
                    res.status(400).send({
                        message: 'Error inserting users.'
                    });
                } else {
                    res.status(200).send({
                        message: 'Added a new user.'
                    });
                }
            });
    } else {
        res.status(400).send({
            message: 'User with this email already exists.'
        });
    }
});

// API route 'courses/add-course'
app.post("/courses/add-course", async (req, res) => {
    return res.status(200);
});

// API route 'courses/delete-course'
app.post("/courses/delete-course", async (req, res) => {
    return res.status(200);
});

// API route 'courses/update-course'
app.post("/courses/update-course", async (req, res) => {
    return res.status(200);
});

// API route 'courses/add-student'
app.post("/courses/add-student", async (req, res) => {
    return res.status(200);
});

// API route 'courses/enroll-student'
app.post("/courses/enroll-student", async (req, res) => {
    return res.status(200);
});

// API route 'courses/add-lesson'
app.post("/courses/add-lesson", async (req, res) => {
    return res.status(200);
});

// API route 'courses/update-lesson'
app.post("/courses/update-lesson", async (req, res) => {
    return res.status(200);
});

// API route 'courses/delete-lesson'
app.post("/courses/delete-lesson", async (req, res) => {
    return res.status(200);
});

app.listen(port, () => {
    console.log('Radi');
});


