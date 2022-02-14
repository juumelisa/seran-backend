const checkDataType = require('../helpers/dataType');
const { isDate, dateDifference, changeDate } = require('../helpers/dateValidator');
const isNull = require('../helpers/isNull');
const response = require('../helpers/response');
const historyModel = require('../models/histasync');
const vehicleModel = require('../models/vehicles');
const userModel = require('../models/users');

exports.getHistories = async(req, res)=>{
  if(req.user.role=='admin'){
    let {vehicle_name, page, limit} = req.query;
    vehicle_name = vehicle_name || '';
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 5;
    const offset = (page-1)*limit;
    const data = {vehicle_name, page, limit, offset};
    console.log(data);
    const historiesResult = await historyModel.getHistories(data);
    if(historiesResult.length>0){
      return response(res, 'List of histories', historiesResult);
    }else{
      return response(res, 'History not found', null);
    }
  }else{
    return response(res, 'You are not allow to see this page', null, 403);
  }
};

exports.getHistory = async(req, res)=>{
  if(req.user.role=='admin'){
    const {id} = req.params;
    if(id>0){
      const historyResult = await historyModel.getHistory(id);
      if(historyResult.length>0){
        return response(res, `Rent History with ID: ${id}`, historyResult[0]);
      }else{
        return response(res, `History with ID: ${id} not found`, null, 404);
      }
    }else{
      return response(res, 'History ID should be a number greater than 0', null, 400);
    }
  }else{
    return response(res, 'You are not allow to see this page', null, 403);
  }
};

exports.addHistory = async(req, res)=>{
  if(req.user.role=='admin'){
    const {vehicle_id, user_id, prepayment, rent_date, return_date} = req.body;
    const data = {vehicle_id, user_id, prepayment, rent_date, return_date};
    const dataName = ['vehicle_id', 'user_id', 'prepayment', 'rent_date', 'return_date'];
    const dataNumber = ['vehicle_id', 'user_id', 'prepayment'];
    const itsNull = isNull(data, dataName);
    if(itsNull){
      return response(res, 'Please fill in all the fields', null, 400);
    }
    const dataType = checkDataType(data, dataNumber, []);
    if(dataType.length>0){
      return response(res, dataType, null, 400);
    }
    const itsDate = isDate(rent_date);
    if(itsDate=='Invalid Date'){
      return response(res, itsDate, null, 400);
    }
    const itsReturnDate = isDate(return_date);
    if(itsReturnDate=='Invalid Date'){
      return response(res, itsReturnDate, null, 400);
    }
    const getUser = await userModel.getUser(data.user_id);
    if (getUser.length<1){
      return response(res, 'User not found', null, 400);
    }
    data.rent_date = changeDate(rent_date);
    data.return_date = changeDate(return_date);
    const dateDiff = dateDifference(rent_date, return_date);
    const userBook = await historyModel.getUser(user_id);
    if(userBook.length>1){
      return response(res, 'User already pass rent limit', null, 400);
    }
    const getVehicle = await vehicleModel.getVehicle(vehicle_id);
    if(getVehicle.length<1){
      return response(res, 'Vehicle not found', null, 404);
    }
    if(getVehicle[0].qty<1){
      return response(res, 'Vehicle not available at the moment', null, 400);
    }
    data.cost = getVehicle[0].cost*dateDiff;
    const min_prepayment = data.cost/2;
    if(prepayment<min_prepayment){
      return response(res, `Minimum prepayment should be Rp${min_prepayment}`, null, 400);
    }
    if(prepayment>data.cost){
      return response(res, `Prepayment should be or less than ${data.cost}`, null, 400);
    }
    data.remain_payment = data.cost - prepayment;
    const addResult = await historyModel.addHistory(data);
    if(addResult.affectedRows>0){
      return response(res, 'success', null);
    }
  }else{
    return response(res, 'You are not allow to do this action', null, 403);
  }
};

exports.updateHistory = async(req, res)=>{
  if(req.user.role=='admin'){
    const {id} = req.params;
    const data = {};
    const dataName = ['vehicle_id', 'user_id', 'cost', 'costAfterDiscount', 'prepayment', 'remain_payment', 'status', 'rent_date', 'return_date'];
    const getResult = await historyModel.getHistory(id);
    if(getResult.length<1){
      return response(res, 'History not found');
    }
    dataName.forEach(x=>{
      if(req.body[x]){
        data[x] = req.body[x];
      }else{
        data[x] = getResult[0][x];
      }
    });
    if(getResult[0].status=='Cancelled' || getResult[0].status=='Returned'){
      return response(res, 'Can\'t change history', null, 400);
    }
    if(req.body.user_id){
      const getUser = await userModel.getUser(data.user_id);
      if (getUser.length<1){
        return response(res, 'User not found', null, 400);
      }
    }
    if(req.body.vehicle_id){
      const getVehicle = await vehicleModel.getVehicle(data.vehicle_id);
      if(getVehicle.length<1){
        return response(res, 'Vehicle not found', null, 404);
      }
    }
    if(req.body.rent_date){
      const itsDate = isDate(req.body.rent_date);
      if(itsDate=='Invalid Date'){
        return response(res, itsDate, null, 400);
      }
      data.rent_date = itsDate;
    }
    if(req.body.return_date){
      const itsReturnDate = isDate(req.body.return_date);
      if(itsReturnDate=='Invalid Date'){
        return response(res, itsReturnDate, null, 400);
      }
      data.return_date = itsReturnDate;
    }
    let a = data.rent_date;
    let b = data.return_date;
    const dateDiffOld = dateDifference(getResult[0].rent_date, getResult[0].return_date);
    const dateDiff = dateDifference(a, b);
    const costPerDay = getResult[0].cost/dateDiffOld;
    data.cost = costPerDay*dateDiff;
    const min_payment = data.cost/2;
    if(data.prepayment<min_payment || data.payment>data.cost){
      return response(res, `Prepayment should between Rp${min_payment} - Rp${data.cost}`);
    }
  
    if(!req.body.status || req.body.status==getResult[0].status){
      const resultUpdate = await historyModel.updateHistory(data, id);
      if(resultUpdate.affectedRows>0){
        const getUpdatedHistory = await historyModel.getHistory(id);
        if(getUpdatedHistory.length>0){
          return response(res, 'Successfully update history', getUpdatedHistory[0]);
        }else{
          return response(res, 'Can\'t get updated history', null, 500);
        }
      }else{
        return response(res, 'Error: Can\'t update history', null, 500);
      }
    }
    if(req.body.status=='Cancelled' || req.body.status=='Returned'){
      const resultUpdate = await historyModel.updateHistory(data, id);
      if(resultUpdate.affectedRows>0){
        const getUpdatedHistory = await historyModel.getHistory(id);
        if(getUpdatedHistory.length>0){
          const changeQty = await historyModel.updateVehicle(data.vehicle_id);
          if(changeQty.affectedRows>0){
            return response(res, 'Successfully update history', getUpdatedHistory[0]);
          }else{
            return response(res, 'Error: Can\' update vehicle', null, 400);
          }
        }else{
          return response(res, 'Can\'t get updated history', null, 500);
        }
      }else{
        return response(res, 'Error: Can\'t update history', null, 500);
      }
  
    }
  }else{
    return response(res, 'You are not allow to do this action', null, 403);
  }
};

exports.deleteHistory = async(req, res)=>{
  if(req.user.role=='admin'){
    const {id} = req.params;
    if(id==null || id==undefined || id==''){
      return response(res, 'Undefined ID', null, 400);
    }
    const historyResult = await historyModel.getHistory(id);
    if(historyResult.length<1){
      return response(res, `History with ID: ${id} not found`, null, 404);
    }
    const deleteResult = await historyModel.deleteHistory(id);
    if(deleteResult.affectedRows>0){
      return response(res, 'Successfully delete history', historyResult[0]);
    }
  }else{
    return response(res, 'You are not allow to do this action', null, 403);
  }
};