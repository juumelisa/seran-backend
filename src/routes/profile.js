const profile = require('express').Router();

const {getProfile} = require('../controller/profile');
const { verifyUser } = require('../helpers/auth');

profile.get('/', verifyUser, getProfile);

module.exports = profile;