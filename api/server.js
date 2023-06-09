import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Comment from './models/Comment.js';
import VotingRoutes from './VotingRoutes.js'
import CommmunityRoutes from './CommunityRoutes.js';
import Community from './models/Community.js';

const secret = 'secret123';
const app = express();

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors({
     origin: 'http://localhost:3000',
     credentials: true,
}));

await mongoose.connect('mongodb+srv://suyash:rjoa7zvue5mGQagd@cluster0.1u8c2l7.mongodb.net/newsAggregator', { useNewUrlParser: true, useUnifiedTopology: true, });
const db = mongoose.connection;
db.on('error', console.log);

app.use(VotingRoutes);
app.use(CommmunityRoutes);

function getUserFromToken(token){
     const userInfo = jwt.verify(token, secret);
     return User.findById(userInfo.id);
}

app.get('/', (req, res) => {
     res.send('Welcome to the server for News Aggregator');
});

app.post('/register', (req, res) => {
     const { email, username } = req.body;
     const password = bcrypt.hashSync(req.body.password, 10);
     User.findOne({ email }).then(user1 => {
          if(user1 == null){
               User.findOne({ username }).then(user2 => {
                    if(user2==null)
                    {
                         const user = new User({ email, username, password });
                         user.save().then(user => {
                              jwt.sign({ id: user._id }, secret, (err, token) => {
                                   if (err) {
                                        console.log(err);
                                        res.send("Invalid username or password");
                                   }
                                   else {
                                        console.log(user);
                                        console.log(token);
                                        res.status(201).cookie('token', token).send();
                                   }
                              });
                         }).catch(event => {
                              console.log(event);
                              res.send("Invalid username or password");
                         });
                    }
                    else{
                         console.log("Username already exist");
                         res.send("Invalid username or password");
                    }
               }).catch(err => {
                    console.log(err);
                    res.send("Invalid username or password");
               });
          }
          else{
               console.log("Email already exist");
               res.send("Invalid username or password");
          }
     }).catch(err => {
          console.log(err);
          res.send("Invalid username or password");
     });
});

app.get('/user', (req, res) => {
     const token = req.cookies.token;
     console.log('Current user token is: ' + token);
     getUserFromToken(token).then(user=> {
          res.json({ username: user.username });
     }).catch(err => {
          console.log(err);
          res.sendStatus(500);
     });
     const userInfo = jwt.verify(token, secret);
});

app.post('/login', (req, res) => {
     const { username, password } = req.body;
     User.findOne({ username }).then(user => {
          if (user && user.username) {
               const passOk = bcrypt.compareSync(password, user.password);
               if (passOk) {
                    jwt.sign({ id: user._id }, secret, (err, token) => {
                         res.cookie('token', token).send();
                    });
               } else {
                    res.send('Invalid username or password');
               }
          } else {
               res.send('Invalid username or password');
          }
     });
});

app.post('/logout', (req, res) => {
     res.cookie('token', '').send();
});

app.get('/comments', (req, res)=>{
     const search = req.query.search;
     const community=req.query.community;
     let filters;
     console.log("search ",search);
     console.log("community ",community);
     if(community){
          if(search){
               filters={"$and":[{body: {$regex: '.*'+search+'.*'}},{community:community}]};
          }
          else{
               filters={community:community};
          }
     }
     else{
          if(search){
               filters={body: {$regex: '.*'+search+'.*'}};
          }
          else{
               filters={rootId:null}
          }
     }
     
     Comment.find(filters).sort({postedAt: -1}).then(comments => {
          res.json(comments);
     });
});

app.get('/search', (req, res)=>{
     const {phrase}= req.query;
     Comment.find({body: {$regex: '.*'+phrase+'.*'}}).sort({postedAt: -1}).then(comments => {
          Community.find({name: {$regex: '.*'+phrase+'.*'}}).then(communities=>{
               res.json({comments,communities});
          })
     });
});



app.get('/comments/root/:rootId', (req, res)=>{
     Comment.find({rootId: req.params.rootId}).sort({postedAt: -1}).then(comments =>{
          res.json(comments);
     });
});


app.get('/comments/:id', (req, res)=>{
     Comment.findById(req.params.id).then(comment => {
          res.json(comment);
     });
});

app.post('/comments', (req, res)=>{
     const token= req.cookies.token;
     if(!token){
          res.sendStatus(401);
          return;
     }
     getUserFromToken(token).then(userInfo=>{
          const {title,body,parentId,rootId,community} = req.body;
          const comment = new Comment({
          title,
          body,
          community,
          author:userInfo.username,
          postedAt:new Date(),
          parentId,
          rootId,
          });
          comment.save().then(savedComment => {
               res.json(savedComment);
          }).catch(console.log);
     }).catch(()=>{
          res.sendStatus(401);
     });
});

app.listen(4000);