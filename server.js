const express = require("express");
const passport = require("passport");
const Sequelize = require("sequelize");
const goodreads = require("goodreads-api-node");
const fetch = require("node-fetch");
const parseXml = require("@rgrove/parse-xml");
const parser = require("fast-xml-parser");
const path = require("path");
const { searchBooks } = require("./booksearch");

const Strategy = require("passport-twitter").Strategy;

const gr = goodreads({
  key: process.env.GOODREADS_KEY,
  secret: process.env.GOODREADS_SECRET
});

const sequelize = new Sequelize(
  "database",
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: "0.0.0.0",
    dialect: "sqlite",
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    },
    storage: ".data/database.sqlite"
  }
);

let User;
let Book;
let Review;
let Plan;

sequelize
  .authenticate()
  .then(function(err) {
    console.log("Connection has been established successfully.");

    // define a new table 'users'
    User = sequelize.define("users", {
      twitter_id: {
        type: Sequelize.STRING
      },
      twitter_username: {
        type: Sequelize.STRING
      }
    });

    Book = sequelize.define("books", {
      source_id: {
        type: Sequelize.STRING
      },
      title: {
        type: Sequelize.STRING
      },
      year: {
        type: Sequelize.STRING
      },
      author: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.TEXT
      },
      image_url: {
        type: Sequelize.STRING
      }
    });

    Review = sequelize.define("reviews", {
      review: {
        type: Sequelize.TEXT
      },
      rating: {
        type: Sequelize.INTEGER
      },
      date_read: {
        type: Sequelize.DATE
      }
    });

    Plan = sequelize.define("plans", {
      note: {
        type: Sequelize.TEXT
      }
    });

    User.hasMany(Review);
    User.hasMany(Plan);
    Book.hasMany(Review);
    Review.belongsTo(Book);
    Review.belongsTo(User);
    Plan.belongsTo(User);
    Book.hasMany(Plan);
    Plan.belongsTo(Book);
    setup();
  })
  .catch(function(err) {
    console.log("Unable to connect to the database: ", err);
  });

function setup() {
  User.sync();
  Book.sync();
  Review.sync();
  Plan.sync();
}

passport.use(
  new Strategy(
    {
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
      callbackURL:
        "https://" +
        process.env.PROJECT_DOMAIN +
        ".glitch.me/login/twitter/return"
    },
    async function(token, tokenSecret, profile, cb) {
      let user = await User.findOne({ where: { twitter_id: profile.id } });
      if (!user) {
        user = await User.create({
          twitter_id: profile.id,
          twitter_username: profile.username
        });
      }

      return cb(null, user);
    }
  )
);

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findByPk(id).then(user => {
    done(null, user);
  });
});

var app = express();

app.use(require("cookie-parser")());
app.use(require("body-parser").urlencoded({ extended: true }));
app.use(
  require("express-session")({
    secret: "keyboard cat",
    resave: true,
    saveUninitialized: true
  })
);

app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Define routes.
app.get("/", function(req, res) {
  res.sendFile(__dirname + "/views/index.html");
});

app.get("/logoff", function(req, res) {
  req.session.destroy();
  res.redirect("/");
});

app.get("/auth/twitter", passport.authenticate("twitter"));

app.get(
  "/login/twitter/return",
  passport.authenticate("twitter", { failureRedirect: "/" }),
  function(req, res) {
    res.redirect("/home");
  }
);

app.get("/users/:username", async function(req, res) {
  const user = await User.findOne({
    where: {
      twitter_username: req.params.username
    }
  });
  if (user) {
    const reviews = await user.getReviews({
      order: [["date_read", "DESC"]],
      include: [Book]
    });
    res.render("reviews", {
      username: user.twitter_username,
      logged_in: !!req.user,
      reviews
    });
  } else {
    res.redirect("/");
  }
});

app.get("/users/:username/reviews/:id", async function(req, res) {
  const user = await User.findOne({
    where: {
      twitter_username: req.params.username
    }
  });
  const review = await Review.findOne({
    where: {
      id: req.params.id,
      userId: user.id
    },
    include: [Book]
  });
  if (user && review) {
    res.render("review", {
      username: user.twitter_username,
      logged_in: !!req.user,
      review
    });
  } else {
    res.redirect("/");
  }
});

app.get("/users/:username/to-read",
  async function(req, res) {
     const user = await User.findOne({
      where: {
        twitter_username: req.params.username
      }
    });
    const plans = await user.getPlans({
      order: [["createdAt", "DESC"]],
      include: [{ model: Book }]
    });
    res.render("plans", {
      username: user.twitter_username,
      logged_in: !!req.user,
      plans
    });
  }
);

app.get(
  "/home",
  require("connect-ensure-login").ensureLoggedIn("/"),
  async function(req, res) {
    console.log(req.user)
    const reviews = await req.user.getReviews({
      order: [["date_read", "DESC"]],
      include: [{ model: Book }]
    });
    res.render("add-review", {
      username: req.user.twitter_username,
      logged_in: !!req.user,
      reviews
    });
  }
);

app.get(
  "/to-read",
  require("connect-ensure-login").ensureLoggedIn("/"),
  async function(req, res) {
    const plans = await req.user.getPlans({
      order: [["createdAt", "DESC"]],
      include: [{ model: Book }]
    });
    console.log(plans)
    res.render("add-plan", {
      username: req.user.twitter_username,
      logged_in: !!req.user,
      plans
    });
  }
);

app.post(
  "/add-review",
  require("connect-ensure-login").ensureLoggedIn("/"),
  async function(req, res) {
    console.log(req.body)
    let book = await Book.findOne({
      where: {
        source_id: req.body.source_id
      }
    });
    if (!book) {
      book = await Book.create({
        source_id: req.body.source_id,
        title: req.body.title,
        author: req.body.author,
        year: req.body.year,
        image_url: req.body.image_url,
        description: req.body.description
      });
    }
    const review = await Review.create({
      review: req.body.review ? req.body.review.trim() : "",
      rating: req.body.rating ? parseInt(req.body.rating) : null,
      date_read: req.body.date_read
    });
    await book.addReview(review);
    await req.user.addReview(review);
    res.redirect("/home");
  }
);

app.post(
  "/plans/:id/create-review",
  require("connect-ensure-login").ensureLoggedIn("/"),
  async function(req, res) {
    const plan = await Plan.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });
    const book = await plan.getBook();
    const review = await Review.create({
      review: req.body.review ? req.body.review.trim() : "",
      rating: req.body.rating ? parseInt(req.body.rating) : null,
      date_read: req.body.date_read
    });
    await book.addReview(review);
    await req.user.addReview(review);
    await plan.destroy();
    res.redirect("/home");
  }
);

app.post(
  "/add-plan",
  require("connect-ensure-login").ensureLoggedIn("/"),
  async function(req, res) {
    let book = await Book.findOne({
      where: {
        source_id: req.body.source_id
      }
    });
    if (!book) {
      book = await Book.create({
        source_id: req.body.source_id,
        title: req.body.title,
        author: req.body.author,
        year: req.body.year,
        image_url: req.body.image_url,
        description: req.body.description
      });
    }
    const plan = await Plan.create({
      note: req.body.note
    });
    await book.addPlan(plan);
    await req.user.addPlan(plan);
    res.redirect("/to-read");
  }
);

app.post(
  "/edit-review/:id",
  require("connect-ensure-login").ensureLoggedIn("/"),
  async function(req, res) {
    const book = await Review.update(
      {
        review: req.body.review ? req.body.review.trim() : "",
        rating: parseInt(req.body.rating),
        date_read: req.body.date_read,
      },
      {
        where: {
          id: req.params.id,
          userId: req.user.id
        }
      }
    );
    res.redirect("/home");
  }
);

app.post(
  "/delete-review/:id",
  require("connect-ensure-login").ensureLoggedIn("/"),
  async function(req, res) {
    await Review.destroy({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });
    res.redirect("/home");
  }
);

app.post(
  "/delete-plan/:id",
  require("connect-ensure-login").ensureLoggedIn("/"),
  async function(req, res) {
    await Plan.destroy({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });
    res.redirect("/to-read");
  }
);

app.get(
  "/booksearch",
  require("connect-ensure-login").ensureLoggedIn("/"),
  async function(req, res) {
    res.setHeader("Content-Type", "application/json");
    const books = await searchBooks(req.query.search);
    res.send(JSON.stringify({ books }));
  }
);

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
