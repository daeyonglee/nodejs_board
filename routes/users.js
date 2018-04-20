var express = require('express');
var router  = express.Router();
var User    = require('../models/User');

// Index
/*
User.find에는 찾을 조건({} = 모든 값)이 들어가고 callback없이 괄호가 닫혔습니다. 
다음번에 sort(정렬)를 넣어주기 위해서인데요,
sort는 username을 기준으로 내림차순합니다.
callback이 find 밖으로 나오게 되면, exec(callback)을 사용해서 불러오게 됩니다.
*/
router.get('/', function(req, res){
  User.find({})
  .sort({username:1})
  .exec(function(err, users){
    if (err) return res.json(err);
    res.render('users/index', {users:users});
  });
});

// New
router.get('/new', function(req, res){
  res.render('users/new', {user:{}});
});

// create
router.post("/", function(req, res){
  User.create(req.body, function(err, user){
   if(err) return res.json(err);
   res.redirect("/users");
  });
});
 
// show
router.get("/:username", function(req, res){
  User.findOne({username:req.params.username}, function(err, user){
    if(err) return res.json(err);
    res.render("users/show", {user:user});
  });
});
 
// edit
router.get("/:username/edit", function(req, res){
  User.findOne({username:req.params.username}, function(err, user){
    if(err) return res.json(err);
    res.render("users/edit", {user:user});
  });
});
 
// update // 2
router.put("/:username",function(req, res, next){
  User.findOne({username:req.params.username}) // 2-1
  .select("password") // 2-2
  .exec(function(err, user){
    if(err) return res.json(err);
    // update user object
    user.originalPassword = user.password;
    user.password = req.body.newPassword? req.body.newPassword : user.password; // 2-3
    for(var p in req.body){ // 2-4
      user[p] = req.body[p];
    }
    // save updated user
    user.save(function(err, user){
      if(err) return res.json(err);
      res.redirect("/users/"+req.params.username);
    });
  });
});
 
 module.exports = router;