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

// app.post("/login", (req, res) => {
//     const email = req.body.email;
//     const password = req.body.password;
//
//
//
// })

const UserModel = mongoose.model('users', new Schema({
    email: String,
    password: String
}));
// const UserDoc = new UserModel({ email: 'email', password: 'password' });
// UserDoc.save();

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

app.listen(port, () => {
    console.log('Radi');
});


