const mongoose = require('mongoose');
const bcrypt   = require('bcrypt-nodejs'); // 보안강화를 위한 hash 사용

/*
  schema : require 에 true 대신 배열이 들어갔습니다. 첫번째는 true/false 값이고, 두번째는 에러메세지입니다. 그냥 true/false을 넣을 경우 기본 에러메세지가 나오고, 배열을 사용해서 custom(사용자정의) 에러메세지를 만들 수 있습니다.
  password에는 select:false가 추가되었습니다. 기본설정은 자동으로 select:true인데, schema항목을 DB에서 읽어옵니다. select:false로 설정하면 DB에서 값을 읽어 올때 해당 값을 읽어오라고 하는 경우에만 값을 읽어오게 됩니다. 비밀번호는 중요하기 때문에
  기본적으로 DB에서 값을 읽어오지 않게 설정했습니다.
*/
var userSchema = mongoose.Schema({
  username:{
    type:String,
    required:[true,"Username is required!"],
    match:[/^.{4,12}$/, "Should be 4-12 characters!"],
    trim:true,
    unique:true
  },
  password:{
    type:String,
    required:[true,"Password is required!"], 
    select:false
  },
  name:{
    type:String, 
    required:[true, "Name is required!"],
    match:[/^.{4,12}$/, "Should be 4-12 characters!"],
    trim:true
  },
  email:{
    type:String,
    required:[true, "Name is required!"],
    match:[/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/, "Should be 4-12 characters!"],
    trim:true
  }
},{
  toObject:{virtuals:true}
});

/*
  DB에 저장되는 값은 password인데, 회원가입, 정보 수정시에는 위 값들이 필요합니다. DB에 저장되지 않아도 되는 정보들은 virtual로 만들어 줍니다.
*/
userSchema.virtaul("passwordConfirmation")
.get(function(){return this._passwordConfirmation})
.set(function(value){this._passwordConfirmation=value;});

userSchema.virtual("originalPassword")
.get(function(){return this._originalPassword;})
.set(function(value){this._originalPassword=value;});

userSchema.virtual("currentPassword")
.get(function(){return this._currentPassword;})
.set(function(value){this._currentPassword=value;});

userSchema.virtaul("newPassword")
.get(function(){return this._newPassword;})
.set(function(value){this._newPassword=value});

// password validation
/*
  DB에 정보를 생성, 수정하기 전에 mongoose가 값이 유효(valid)한지
  확인(validate)을 하게 되는데 password항목에 custom(사용자정의)
  validation 함수를 지정할 수 있습니다. virtual들은 직접 validation이 
  안되기 때문에(DB에 값을 저장하지 않으니까 어찌보면 당연합니다)
  password에서 값을 확인하도록 했습니다.
*/
var passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,16}$/;
var passwordRegexErrorMessage = "Should be minimum 8 characters of alphabet and number combination!";
userSchema.path("password").validate(function(v){
  // validation callback 함수 속에서 this는 user model입니다.
  var user = this;

  // create user
  /*
    회원가입의 경우 password confirmation값이 없는 경우,
    password와 password confirmation값이 다른 경우에
    유효하지않음처리(invalidate)를 하게 됩니다.
    model.invalidate함수를 사용하며, 첫번째는 인자로 항목이름, 두번째 인자로 에러메세지를 받습니다.
  */
  if (user.isNew){ // model.isNew 항목이 true이면 새로 생긴 model(DB에 한번도 기록되지 않았던 model) 즉, 새로 생성되는 user이며, 값이 false이면 DB에서 읽어 온 model 즉, 회원정보를 수정하는 경우입니다. 
    if(!user.passwordConfirmation){
      user.invalidate("passwordConfirmation", "Password Confirmation is required!");
    }
    if(!passwordRegex.test(user.password)){
      user.invalidate("password", passwordRegexErrorMessage);
    } else if(user.password !== user.passwordConfirmation) {
      user.invalidate("passwordConfirmation", "Password Confirmation does not matched!");
    }
  }
  // update user
  /*
    회원정보 수정의 경우 current password값이 없는 경우,
    current password값이 original password랑 다른 경우,
    new password 와 password confirmation값이 다른 경우 invalidate합시다.
    회원정보 수정시에는 항상 비밀번호를 수정하는 것은 아니기 때문에 
    new password와 password confirmation값이 없어도 에러는 아닙니다.
  */
 if(!user.isNew){
    if(!user.currentPassword){
      user.invalidate("currentPassword", "Current Password is required!");
    }
    if(user.currentPassword && !bcrypt.compareSync(user.currentPassword, user.originalPassword)){
      user.invalidate("currentPassword", "Current Password is invalid!");
    }
    if(user.newPassword && !passwordRegex.test(user.newPassword)){
      user.invalidate("newPassword", passwordRegexErrorMessage);
    } else if(user.newPassword !== user.passwordConfirmation) {
      user.invalidate("passwordConfirmation", "Password Confirmation does not matched!");
    }
  }
});

// hash password
/*
  Schema.pre 함수는 첫번째 파라미터로 설정된 event가 일어나기 전(pre)에 먼저 callback 함수를 실행시킵니다.
  "save" event는 Model.create, model.save 함수 실행시 발생하는 event입니다.
  즉 user를 생성하거나 user를 수정한 뒤 save 함수를 실행 할 때 callback 함수가 먼저 호출됩니다.

*/
userSchema.pre('save', function (next){
  var user = this;
  /*
    isModified함수는 해당 값이 db에 기록된 값과 비교해서
    변경된 경우 true를, 그렇지 않은 경우 false를
    return하는 함수입니다. user 생성시는 항상 true이며,
    user 수정시는 password가 변경되는 경우에만 true를 리턴합니다.
    user.password의 변경이 없는 경우라면 이미 해당위치에 hash가 저장되어 있으므로 다시 hash를 만들지 않습니다.
  */
  if (!user.isModified('password')) {
    return next();
  } else {
    /*
      user를 생성하거나 user수정시 user.password의 변경이 있는 경우에는 bcrypt.hashSync 함수로 password를 hash값으로 바꿉니다.
    */
    user.password = bcrypt.hashSync(user.password);
    return next();
  }
});

// model methods
/*
  user model의 password hash와 입력받은 password text를 비교하는 method
*/
userSchema.methods.authenticate = function(password) {
  var user = this;
  return bcrypt.compareSync(password, user.password);
}

/*
  user model의 password hash와 입력받은 password text를 비교하는 method를 추가합니다. 이번 예제에 사용되는 method는 아니고 나중에 로그인을 만들때 될
  method인데 bcrypt를 사용하므로 지금 추가해봤습니다.
*/
// model & export
var User = mongoose.model("user",userSchema);
module.exports = User;